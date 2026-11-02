import { z } from 'zod';
export declare const policyInput: z.ZodObject<{
    mode: z.ZodEnum<{
        accept: "accept";
        hold: "hold";
        refuse: "refuse";
    }>;
    senders: z.ZodArray<z.ZodString>;
    operatorSources: z.ZodOptional<z.ZodArray<z.ZodString>>;
    crossWorkspace: z.ZodBoolean;
    alias: z.ZodString;
}, z.core.$strict>;
