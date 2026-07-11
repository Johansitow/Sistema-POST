import { describe, it, expect } from 'vitest';
import { createClienteSchema, updateClienteSchema } from '../cliente.dto';

describe('createClienteSchema', () => {
  it('acepta email, numero_documento y fecha_nacimiento vacíos y los normaliza a undefined', () => {
    const result = createClienteSchema.parse({
      nombre_completo:  'Juan Pérez',
      email:            '',
      numero_documento: '',
      fecha_nacimiento: '',
    });

    expect(result.email).toBeUndefined();
    expect(result.numero_documento).toBeUndefined();
    expect(result.fecha_nacimiento).toBeUndefined();
  });

  it('acepta el request sin esos campos en absoluto (cliente de paso, solo nombre)', () => {
    const result = createClienteSchema.parse({ nombre_completo: 'Cliente Rápido' });
    expect(result.email).toBeUndefined();
    expect(result.numero_documento).toBeUndefined();
    expect(result.fecha_nacimiento).toBeUndefined();
  });

  it('sigue rechazando un email con formato inválido', () => {
    expect(() => createClienteSchema.parse({
      nombre_completo: 'Juan Pérez',
      email:           'no-es-un-email',
    })).toThrow(/Email inválido/);
  });

  it('sigue rechazando una fecha de nacimiento con formato inválido', () => {
    expect(() => createClienteSchema.parse({
      nombre_completo:  'Juan Pérez',
      fecha_nacimiento: 'no-es-una-fecha',
    })).toThrow(/Fecha de nacimiento inválida/);
  });

  it('acepta un email válido y lo conserva', () => {
    const result = createClienteSchema.parse({
      nombre_completo: 'Juan Pérez',
      email:           'juan@test.com',
    });
    expect(result.email).toBe('juan@test.com');
  });

  it('acepta distintos formatos razonables de fecha de nacimiento', () => {
    for (const fecha of ['1990-05-15', '1990-05-15T00:00:00Z', '1990-05-15T00:00']) {
      const result = createClienteSchema.parse({ nombre_completo: 'Juan Pérez', fecha_nacimiento: fecha });
      expect(result.fecha_nacimiento).toBe(fecha);
    }
  });

  it('rechaza un nombre_completo ausente', () => {
    expect(() => createClienteSchema.parse({})).toThrow();
  });
});

describe('updateClienteSchema', () => {
  it('acepta email, numero_documento y fecha_nacimiento vacíos y los normaliza a undefined', () => {
    const result = updateClienteSchema.parse({
      email:            '',
      numero_documento: '',
      fecha_nacimiento: '',
    });

    expect(result.email).toBeUndefined();
    expect(result.numero_documento).toBeUndefined();
    expect(result.fecha_nacimiento).toBeUndefined();
  });

  it('sigue rechazando un email con formato inválido', () => {
    expect(() => updateClienteSchema.parse({ email: 'no-es-un-email' })).toThrow(/Email inválido/);
  });
});
