export declare class SocketScope {
 current: any;
 generation: number;
 bindings: Map<string, any>;
 set<T>(socket: T): T;
 get(): any;
 run<T>(socket: any, task: () => T): T;
 bind(key: string, event: string, listener: (...args: any[]) => any): (...args: any[]) => any;
 clearBindings(): void;
 close(): void;
 installLegacyAccessors(target: any): void;
}
export declare class CommandRegistry {
 constructor(plugins?: Record<string, any>, options?: Record<string, any>);
 conflicts: Map<string, any>;
 rebuild(plugins: Record<string, any>): this;
 owner(command: string): string | undefined;
 resolve(text: string, options?: Record<string, any>): any;
 report(): any;
}
export declare class BoundedDedup {
 constructor(options?: { max?: number; ttl?: number; clock?: () => number });
 accept(key: string): boolean;
}
export declare class ReconnectPlan {
 constructor(options?: { max?: number; base?: number; cap?: number; random?: () => number });
 attempts: number;
 next(reason?: number): number | null;
 reset(): void;
}
export declare function matches(spec: any, command: string): boolean;
export declare function aliasesOf(plugin: any): string[];
