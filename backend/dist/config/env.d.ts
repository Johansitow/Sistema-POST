/**
 * Configuración centralizada de variables de entorno
 */
export declare const config: {
    readonly database: {
        readonly url: string;
    };
    readonly server: {
        readonly port: number;
        readonly env: "production" | "development" | "test";
        readonly isDevelopment: boolean;
        readonly isProduction: boolean;
        readonly isTest: boolean;
    };
    readonly jwt: {
        readonly secret: string;
        readonly expiresIn: string;
        readonly refreshSecret: string;
        readonly refreshExpiresIn: string;
    };
    readonly cors: {
        readonly origin: string;
    };
    readonly rateLimit: {
        readonly windowMs: number;
        readonly maxRequests: number;
    };
    readonly logging: {
        readonly level: "info" | "error" | "warn" | "debug";
    };
};
export default config;
//# sourceMappingURL=env.d.ts.map