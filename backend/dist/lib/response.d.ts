/**
 * response.ts - Helper para respuestas HTTP estandarizadas
 */
export declare const successResponse: <T>(data: T, message?: string) => {
    data: T;
    message?: string | undefined;
    success: boolean;
};
//# sourceMappingURL=response.d.ts.map