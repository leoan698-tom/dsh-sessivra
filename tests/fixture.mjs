import { Context } from '@deepseek-ai/cordis';
import * as agent from '@deepseek-ai/dsh-agent';
import Session from '@deepseek-ai/dsh-session';
import Projections from '@deepseek-ai/dsh-session-projection';
import Llm, { LlmAdapter } from '@deepseek-ai/dsh-llm';
import Tools from '@deepseek-ai/dsh-tools';
import Prompt from '@deepseek-ai/dsh-system-prompt';
import Loop from '@deepseek-ai/dsh-agent-loop';
import * as Storage from '@deepseek-ai/dsh-storage';
import * as Json from '@deepseek-ai/dsh-storage-json';
import * as Domain from '@deepseek-ai/dsh-storage-domain';
import Typert from '@deepseek-ai/dsh-typert-registry';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import RemoteAccess from '@deepseek-ai/dsh-api-remote-access';
import * as Plugin from '../dist/index.js';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
export const productUnderTest = process.env.DSHSM_PRODUCT_ENTRY ? await import(pathToFileURL(process.env.DSHSM_PRODUCT_ENTRY)) : Plugin;

/** Deterministic free adapter; actual Cordis/DSH registries, AgentLoop, tools, inbox and disk storage. */
export class FreeAdapter extends LlmAdapter {
  calls = [];
  script;
  async resolveModel(provider, model) { return { provider, id:model, name:model, contextWindow:100000 }; }
  async *stream(options) {
    this.calls.push(options);
    if (this.script) { yield* this.script(options); return; }
    yield { type:'block-start', index:0, blockType:'text' };
    yield { type:'text-delta', index:0, text:'Synthetic acknowledgement.' };
    yield { type:'block-end', index:0, block:{type:'text',text:'Synthetic acknowledgement.'} };
    yield { type:'finish', reason:'stop' };
  }
}
export async function host(root, pluginModule = productUnderTest) {
  const ownsRoot = root === undefined;
  const tempRoot = ownsRoot ? await realpath(tmpdir()) : undefined;
  root ??= await mkdtemp(join(tempRoot,'dshsm-'));
  const ctx=new Context();
  for (const p of [Typert,Projections,Session,Llm,Tools,Prompt,agent.default,Storage.default]) await ctx.plugin(p);
  // DSH 0.2.2 separates executor selection from the tool registry.
  if (typeof ctx.tools.setExecutor === 'function') await ctx.plugin(await import('@deepseek-ai/dsh-tool-executor-native'));
  await ctx.plugin(Json,{root});
  await ctx.plugin(Domain,{backend:'json'});
  await ctx.plugin(RemoteAccess);
  await ctx.plugin(Gateway);
  const adapter=new FreeAdapter(); ctx.llm.registerAdapter(['synthetic-free'],adapter);
  await ctx.plugin(Loop);
  const plugin=await ctx.plugin(pluginModule);
  const peerLifetime=new AbortController();
  // In-process test carrier owns its principal. This is never a wire argument.
  const peer={id:'synthetic-owner-peer',ctx,principal:{kind:'owner'},signal:peerLifetime.signal,interactions:'none',dispose:async()=>peerLifetime.abort()};
  return {ctx,adapter,plugin,root,peer,
    create: (id,cwd=root) => ctx.agents.create({sessionId:id,agentOptions:{provider:'synthetic-free',model:'fixture'},meta:{cwd}}),
    rpc: (method,args={}) => ctx.typertGateway.invoke({namespace:'sessionMessenger',method,args,peer}),
    tool: async (agent,name,args) => {
      const signal = new AbortController().signal;
      if (typeof ctx.tools.setExecutor === 'function') {
        const batch = await ctx.tools.execute({calls:[{type:'tool-call',id:randomUUID(),name,arguments:JSON.stringify(args)}],agent,signal});
        return batch.results[0].result;
      }
      return ctx.tools.execute({callId:randomUUID(),name,arguments:args,agent,signal});
    },
    close: async () => {
      peerLifetime.abort();
      await ctx.fiber.dispose();
      if (ownsRoot) {
        // Only the exact mkdtemp child this fixture created; never a supplied profile path.
        if (dirname(resolve(root)) !== tempRoot || !/^dshsm-[a-zA-Z0-9_-]+$/.test(basename(root))) throw new Error('UNSAFE_TEST_CLEANUP');
        await rm(root,{recursive:true,force:true});
      }
    }
  };
}
export function value(result) { if(result.isError) throw new Error(JSON.stringify(result)); return JSON.parse(result.content[0].text); }
