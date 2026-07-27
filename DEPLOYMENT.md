# Guía de despliegue del POS

Esta guía te lleva de "funciona en mi PC" a "está en internet con su candado HTTPS",
explicado en pasos simples. Arquitectura elegida: **base de datos administrada**
(Neon/Supabase) + **un servidor (VPS)** con **Docker** y **Caddy** (que pone el HTTPS solo).

Piezas que van a vivir en internet:

- **La base de datos** → en un servicio administrado (te hace los respaldos solo).
- **El backend** (la API) → un contenedor en tu servidor.
- **El frontend** (la pantalla) → lo sirve Caddy en tu servidor, junto con el candado HTTPS.

---

## 0. Lo que necesitas antes de empezar

- Una **base de datos PostgreSQL administrada**. Recomendado: [Neon](https://neon.tech)
  o [Supabase](https://supabase.com) (ambos tienen plan gratis para empezar).
- Un **servidor VPS** con Ubuntu (p.ej. DigitalOcean, Hostinger, AWS Lightsail; ~5 USD/mes).
- Un **dominio** (p.ej. Namecheap, GoDaddy; ~10 USD/año).

---

## 1. Crea la base de datos administrada

1. Crea una cuenta en Neon (o Supabase) y crea un proyecto/base.
2. Copia la **cadena de conexión** (connection string). Se ve así:
   `postgresql://usuario:clave@host.neon.tech/basededatos?sslmode=require`
3. Guárdala: la vas a poner en `DATABASE_URL` más adelante.

> La ventaja de esto: el servicio hace los **respaldos automáticos** y el cifrado por ti.

## 2. Consigue el servidor y apunta el dominio

1. Crea el VPS con Ubuntu. Anota su **IP pública**.
2. En tu proveedor de dominio, crea un registro **A** que apunte tu dominio
   (p.ej. `pos.midominio.com`) a esa **IP**. Espera unos minutos a que propague.

## 3. Instala Docker en el servidor

Conéctate al servidor (`ssh usuario@IP`) y ejecuta:

```bash
curl -fsSL https://get.docker.com | sh
```

Esto instala Docker y Docker Compose.

## 4. Baja el código y configura las variables

```bash
git clone <URL-de-tu-repo> pos && cd pos
```

Necesitas **dos** archivos de configuración (ninguno se sube a git):

**a) Variables del despliegue (raíz):**

```bash
cp .env.production.example .env
nano .env
```

Pon tu dominio y tu correo:

```
DOMAIN=pos.midominio.com
ACME_EMAIL=tu-correo@ejemplo.com
```

**b) Variables del backend:**

```bash
cp backend/.env.example backend/.env.production
nano backend/.env.production
```

Completa al menos estos (mira los comentarios del archivo para el resto):

```
NODE_ENV=production
DATABASE_URL=postgresql://...   # la cadena de Neon del paso 1
JWT_SECRET=<clave larga y aleatoria de 32+ caracteres>
JWT_REFRESH_SECRET=<otra clave distinta de 32+ caracteres>
CORS_ORIGIN=https://pos.midominio.com
SUPER_ADMIN_UUID=<un UUID que generes>
SEED_ADMIN_PASSWORD=<una contraseña fuerte para el admin>
```

Para generar claves y el UUID:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # claves JWT
node -e "console.log(require('crypto').randomUUID())"                          # SUPER_ADMIN_UUID
```

## 5. Levanta todo

```bash
docker compose up -d --build
```

Esto construye las imágenes y arranca backend, redis y Caddy. Al arrancar, el backend
**aplica las migraciones solo** (`prisma migrate deploy`). Caddy saca el certificado
HTTPS automáticamente (por eso el dominio debe apuntar ya al servidor y los puertos
80/443 deben estar abiertos).

### Sembrar el usuario administrador (solo la primera vez)

La base administrada arranca vacía. Crea el admin inicial:

```bash
docker compose exec backend npm run seed
```

> En producción el seed **exige** `SUPER_ADMIN_UUID` y `SEED_ADMIN_PASSWORD` (ya los
> pusiste en `backend/.env.production`): se niega a sembrar con credenciales por defecto.

## 6. Verifica que quedó bien

- Abre `https://pos.midominio.com` en el navegador: debe cargar con el candado.
- Revisa la salud del backend:

```bash
curl https://pos.midominio.com/health   # o entra a esa URL en el navegador
docker compose ps                        # todos "running"/"healthy"
docker compose logs -f backend           # ver logs en vivo
```

El `/health` devuelve `db: "up"` si conectó a la base. Si dice `down`, revisa `DATABASE_URL`.

---

## Actualizar a una versión nueva

```bash
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al reiniciar el backend.

## Respaldos

Con base administrada (Neon/Supabase) los respaldos son **automáticos** desde su panel.
Aun así, para un respaldo manual puntual puedes usar los scripts de
`backend/scripts/` (ver `backend/scripts/README.md`) apuntando `DATABASE_URL` a la base.

## Problemas comunes

- **No sale el candado / certificado:** el dominio no apunta aún a la IP, o los puertos
  80/443 están cerrados en el firewall del VPS. Revisa el DNS y abre esos puertos.
- **`db: down` en /health:** `DATABASE_URL` mal escrita o la base no acepta conexiones
  externas. En Neon/Supabase copia la cadena con `sslmode=require`.
- **El backend reinicia en bucle:** mira `docker compose logs backend`. Suele ser una
  variable de entorno faltante (el arranque falla a propósito si falta algo crítico).

## Probar en local (sin dominio)

Para probar el stack en tu máquina, pon `DOMAIN=localhost` en `.env` y usa una
`DATABASE_URL` de prueba. Caddy usará un certificado interno; el navegador avisará que
no es de confianza (normal en local).
