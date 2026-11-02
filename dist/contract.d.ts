import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
export declare const descriptors: InvocationDescriptor[];
export declare const remoteContribution: {
    package: string;
    descriptors: InvocationDescriptor[];
};
export declare const hostContribution: {
    package: string;
    face: "host";
    schemas: never[];
    model: {
        services: never[];
        events: never[];
        objects: never[];
    };
    invocations: InvocationDescriptor[];
};
