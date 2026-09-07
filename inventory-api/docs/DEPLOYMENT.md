# Manual de Despliegue en Servidor

> **Estado del proyecto:** Listo para producción.
> Stack: Node.js 24 · Express · Prisma · PostgreSQL 16 · Redis 7 · Docker

---

## Índice

1. [Requisitos del servidor](#1-requisitos-del-servidor)
2. [¿Qué falta antes de subir?](#2-qué-falta-antes-de-subir)
3. [Preparar el repositorio en GitHub](#3-preparar-el-repositorio-en-github)
4. [Preparar el servidor](#4-preparar-el-servidor)
5. [Clonar el proyecto en el servidor](#5-clonar-el-proyecto-en-el-servidor)
6. [Configurar las variables de entorno](#6-configurar-las-variables-de-entorno)
7. [Primer despliegue](#7-primer-despliegue)
8. [Configurar HTTPS con Nginx (recomendado)](#8-configurar-https-con-nginx-recomendado)
9. [Actualizar el servidor cuando hay cambios](#9-actualizar-el-servidor-cuando-hay-cambios)
10. [Backups de la base de datos](#10-backups-de-la-base-de-datos)
11. [Comandos útiles de operación](#11-comandos-útiles-de-operación)
12. [Checklist de go-live](#12-checklist-de-go-live)

---

## 1. Requisitos del servidor

| Recurso | Mínimo recomendado |
|---|---|
| CPU | 1 vCPU |
| RAM | 2 GB (4 GB ideal) |
| Disco | 20 GB SSD |
| Sistema operativo | Ubuntu 22.04 LTS o 24.04 LTS |
| Puertos abiertos | 22 (SSH), 80 (HTTP), 443 (HTTPS) |

**Proveedores donde podés obtener un VPS:**
- [DigitalOcean](https://digitalocean.com) — Droplet desde $6/mes
- [Hetzner](https://hetzner.com) — Desde €4/mes (más económico)
- [Linode (Akamai)](https://linode.com)
- [AWS EC2](https://aws.amazon.com/ec2/) (t3.small o t3.medium)

---

## 2. ¿Qué falta antes de subir?

El código está listo. Lo que necesitás completar antes del despliegue:

| Tarea | Estado |
|---|---|
| Dockerfile de producción | ✅ Existe (`Dockerfile`) |
| Docker Compose de producción | ✅ Existe (`docker-compose.prod.yml`) |
| Migraciones de base de datos | ✅ Listas en `prisma/migrations/` |
| Seed inicial de datos | ✅ Existe (`prisma/seed.js`) |
| Variables de entorno de ejemplo | ✅ Existe (`.env.production.example`) |
| Health check | ✅ Implementado en `/health/ready` |
| **Crear archivo `.env.production`** | ⚠️ Pendiente (con tus contraseñas reales) |
| **Dominio configurado** | ⚠️ Apuntar DNS al servidor |
| **Instalar Docker en el servidor** | ⚠️ Ver sección 4 |

---

## 3. Preparar el repositorio en GitHub

### 3.1 Asegurarte de que el `.gitignore` esté correcto

El archivo `.gitignore` ya está configurado para **no subir**:
- `node_modules/`
- `.env` y `.env.production` (tus contraseñas nunca van a GitHub)
- `storage/` (archivos subidos por usuarios)
- `logs/`
- `specs/` (documentación interna)

Lo que **sí se sube** a GitHub:
- Todo el código fuente (`src/`)
- Las migraciones (`prisma/migrations/`)
- Los archivos de configuración Docker
- Los ejemplos de variables (`.env.example`, `.env.production.example`)

### 3.2 Subir el proyecto a GitHub

Si todavía no tenés el proyecto en GitHub, desde tu máquina local:

```bash
# 1. Inicializar git (si no está inicializado)
cd inventory-api
git init
git branch -M main

# 2. Agregar todos los archivos
git add .
git commit -m "feat: initial production-ready commit"

# 3. Crear el repositorio en github.com (hacerlo vacío, sin README)
# Luego conectar:
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

### 3.3 Si el repositorio es privado

Podés usar cualquiera de estas opciones para que el servidor pueda clonar:
- **Deploy key** (recomendado para servidores): clave SSH específica para el repositorio
- **Personal Access Token** de GitHub (más simple)

Se explica en la sección 5.

---

## 4. Preparar el servidor

Conectarte al servidor por SSH:

```bash
ssh root@IP_DEL_SERVIDOR
```

### 4.1 Actualizar el sistema

```bash
apt update && apt upgrade -y
```

### 4.2 Instalar Docker

```bash
# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Verificar instalación
docker --version
docker compose version
```

### 4.3 Crear un usuario no-root (buena práctica)

```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy

# Copiar tu clave SSH al nuevo usuario
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Desde aquí en adelante, trabajar como usuario `deploy`:

```bash
su - deploy
```

### 4.4 Instalar Git

```bash
sudo apt install git -y
```

---

## 5. Clonar el proyecto en el servidor

### Opción A — Repositorio público (más simple)

```bash
cd /home/deploy
git clone https://github.com/TU_USUARIO/TU_REPOSITORIO.git inventory-api
cd inventory-api
```

### Opción B — Repositorio privado con Personal Access Token

1. En GitHub: Settings → Developer Settings → Personal Access Tokens → Generate new token (classic)
2. Permisos mínimos: `repo` (read)

```bash
git clone https://TU_USUARIO:TOKEN_AQUI@github.com/TU_USUARIO/TU_REPOSITORIO.git inventory-api
cd inventory-api
```

### Opción C — Repositorio privado con Deploy Key (más seguro)

En el servidor:

```bash
# Generar clave SSH para el servidor
ssh-keygen -t ed25519 -C "deploy@servidor" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

Copiar la clave pública que se muestra y agregarla en GitHub:
**Repositorio → Settings → Deploy keys → Add deploy key** (solo lectura es suficiente)

```bash
# Configurar SSH para usar esa clave con GitHub
cat >> ~/.ssh/config << 'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
  StrictHostKeyChecking no
EOF

# Clonar
git clone git@github.com:TU_USUARIO/TU_REPOSITORIO.git inventory-api
cd inventory-api
```

---

## 6. Configurar las variables de entorno

Esto es lo más importante. **Nunca subas este archivo a GitHub.**

```bash
# Estar dentro del directorio del proyecto
cd /home/deploy/inventory-api

# Copiar el ejemplo de producción
cp .env.production.example .env.production

# Editar con tus valores reales
nano .env.production
```

### Variables que DEBÉS cambiar obligatoriamente

```bash
# ── Base de datos ─────────────────────────────────────────────────
POSTGRES_DB=tracksys
POSTGRES_USER=tracksys
POSTGRES_PASSWORD=CONTRASEÑA_MUY_SEGURA_AQUI   # ← cambiar

# ── URL de conexión (debe coincidir con POSTGRES_USER/PASSWORD/DB) ─
DATABASE_URL=postgresql://tracksys:CONTRASEÑA_MUY_SEGURA_AQUI@db:5432/tracksys?schema=public

# ── Dominio de la aplicación ──────────────────────────────────────
CORS_ORIGIN=https://tudominio.com               # ← tu dominio real
APP_BASE_URL=https://tudominio.com              # ← tu dominio real

# ── Seguridad JWT ─────────────────────────────────────────────────
JWT_SECRET=GENERA_UN_SECRET_LARGO_ALEATORIO_AQUI  # ← cambiar
JWT_EXPIRES_IN=8h

# ── Redis (no necesita cambio si usás docker-compose.prod.yml) ────
BROWSER_SESSION_STORE_MODE=redis
REDIS_URL=redis://redis:6379/0
```

### Generar un JWT_SECRET seguro

```bash
# En el servidor, ejecutar este comando y copiar el resultado:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Verificar que el archivo quedó bien

```bash
cat .env.production
```

Asegurarte de que no quede ningún valor que diga `replace_me`.

---

## 7. Primer despliegue

```bash
# Estar en el directorio del proyecto
cd /home/deploy/inventory-api

# 1. Construir y levantar (la primera vez tarda ~3-5 minutos)
docker compose -f docker-compose.prod.yml up -d --build

# 2. Verificar que todos los servicios están corriendo
docker compose -f docker-compose.prod.yml ps
```

Deberías ver algo así:

```
NAME                    STATUS          PORTS
inventory-api-db-1      running (healthy)
inventory-api-redis-1   running (healthy)
inventory-api-migrate-1 exited (0)        ← Esto es correcto, solo corre las migraciones
inventory-api-app-1     running (healthy)  0.0.0.0:2500->2500/tcp
```

El servicio `migrate` sale con código 0 (éxito) y eso es **normal** — solo aplica las migraciones al inicio.

### 7.1 Verificar que la aplicación responde

```bash
curl http://localhost:2500/health/ready
```

Respuesta esperada:
```json
{"status":"ok"}
```

### 7.2 Cargar datos iniciales (seed)

Solo hacer esto **una vez**, en el primer despliegue:

```bash
docker compose -f docker-compose.prod.yml exec app npm run prisma:seed
```

> **Importante:** El seed crea el usuario root y los roles iniciales.
> Las contraseñas del seed se leen de las variables `SEED_*` del entorno.
> Si no las configuraste en `.env.production`, el seed usará valores por defecto
> definidos en `prisma/seed.js` — revisá ese archivo para saber cuáles son.

Para agregar las contraseñas del seed al `.env.production`:

```bash
# Agregar al final del .env.production:
echo "SEED_ROOT_PASSWORD=contraseña_del_root_aqui" >> .env.production
```

Luego reiniciar la app para que tome los nuevos valores y ejecutar el seed:

```bash
docker compose -f docker-compose.prod.yml restart app
docker compose -f docker-compose.prod.yml exec app npm run prisma:seed
```

---

## 8. Configurar HTTPS con Nginx (recomendado)

La app corre en el puerto 2500. Nginx actúa como proxy inverso y maneja SSL.

### 8.1 Instalar Nginx y Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 8.2 Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/inventory
```

Pegar esta configuración (reemplazar `tudominio.com`):

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Certbot usará esto para verificar el dominio
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirigir todo lo demás a HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name tudominio.com www.tudominio.com;

    # Certbot llenará esto automáticamente
    ssl_certificate /etc/letsencrypt/live/tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tudominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Tamaño máximo de archivos subidos (documentos de clientes)
    client_max_body_size 10M;

    # Proxy a la app Node.js
    location / {
        proxy_pass http://127.0.0.1:2500;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

### 8.3 Activar la configuración

```bash
sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
sudo nginx -t          # verificar que no hay errores de sintaxis
sudo systemctl reload nginx
```

### 8.4 Obtener el certificado SSL (Let's Encrypt, gratis)

```bash
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Certbot pedirá tu email y aceptar los términos. El certificado se renueva automáticamente.

### 8.5 Actualizar las variables de entorno con HTTPS

```bash
nano /home/deploy/inventory-api/.env.production
```

Cambiar:
```
CORS_ORIGIN=https://tudominio.com
APP_BASE_URL=https://tudominio.com
```

Reiniciar la app:
```bash
cd /home/deploy/inventory-api
docker compose -f docker-compose.prod.yml restart app
```

---

## 9. Actualizar el servidor cuando hay cambios

Cada vez que hagas cambios en el código y los subas a GitHub:

```bash
# En el servidor
cd /home/deploy/inventory-api

# 1. Traer los últimos cambios de GitHub
git pull origin main

# 2. Reconstruir y reiniciar (solo la app, no la DB)
docker compose -f docker-compose.prod.yml up -d --build app migrate

# 3. Verificar que levantó bien
docker compose -f docker-compose.prod.yml ps
curl http://localhost:2500/health/ready
```

> El servicio `migrate` corre automáticamente las migraciones nuevas antes de que la app arranque.

---

## 10. Backups de la base de datos

### Backup manual

```bash
# Crear un backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U tracksys tracksys | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Verificar el backup
ls -lh backup_*.sql.gz
```

### Restaurar un backup

```bash
# Restaurar (¡cuidado, borra los datos actuales!)
gunzip -c backup_FECHA.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T db \
  psql -U tracksys tracksys
```

### Backup automático con cron

```bash
crontab -e
```

Agregar esta línea para hacer backup cada día a las 3am:

```
0 3 * * * cd /home/deploy/inventory-api && docker compose -f docker-compose.prod.yml exec -T db pg_dump -U tracksys tracksys | gzip > /home/deploy/backups/backup_$(date +\%Y\%m\%d).sql.gz 2>/dev/null
```

Crear el directorio de backups:
```bash
mkdir -p /home/deploy/backups
```

### Backup del volumen de archivos (storage)

```bash
# Los archivos subidos (documentos de clientes, comprobantes) están en el volumen app_storage
# Para hacer backup del volumen:
docker run --rm \
  -v inventory-api_app_storage:/data \
  -v /home/deploy/backups:/backup \
  alpine tar czf /backup/storage_$(date +%Y%m%d).tar.gz -C /data .
```

---

## 11. Comandos útiles de operación

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f app

# Ver logs de la base de datos
docker compose -f docker-compose.prod.yml logs -f db

# Ver el estado de todos los servicios
docker compose -f docker-compose.prod.yml ps

# Reiniciar solo la aplicación (sin tocar la DB)
docker compose -f docker-compose.prod.yml restart app

# Detener todo
docker compose -f docker-compose.prod.yml down

# Detener todo Y borrar los datos (¡destructivo!)
docker compose -f docker-compose.prod.yml down -v

# Abrir una consola en el contenedor de la app
docker compose -f docker-compose.prod.yml exec app sh

# Abrir una consola de PostgreSQL
docker compose -f docker-compose.prod.yml exec db psql -U tracksys tracksys

# Ver uso de disco de los volúmenes Docker
docker system df

# Limpiar imágenes viejas (libera espacio)
docker image prune -f
```

---

## 12. Checklist de go-live

Revisá cada punto antes de compartir el link a los usuarios:

### Infraestructura
- [ ] Servidor corriendo con al menos 2 GB de RAM
- [ ] Docker y Docker Compose instalados
- [ ] Puertos 80 y 443 abiertos en el firewall
- [ ] Dominio apuntando a la IP del servidor (DNS propagado)

### Configuración
- [ ] `.env.production` creado con valores reales (sin ningún `replace_me`)
- [ ] `POSTGRES_PASSWORD` es una contraseña fuerte y única
- [ ] `JWT_SECRET` es una cadena aleatoria de al menos 64 caracteres
- [ ] `CORS_ORIGIN` y `APP_BASE_URL` apuntan al dominio con `https://`
- [ ] `REDIS_URL` apunta al servicio Redis dentro de Docker (`redis://redis:6379/0`)

### Despliegue
- [ ] `docker compose -f docker-compose.prod.yml ps` muestra todos los servicios `running (healthy)`
- [ ] `curl https://tudominio.com/health/ready` responde `{"status":"ok"}`
- [ ] Certificado SSL activo (el navegador muestra el candado)
- [ ] Seed inicial ejecutado (`npm run prisma:seed`)
- [ ] Podés iniciar sesión con el usuario root

### Seguridad
- [ ] SSH con llave (no contraseña)
- [ ] Firewall configurado (`ufw allow 22`, `ufw allow 80`, `ufw allow 443`, `ufw enable`)
- [ ] El puerto 2500 NO está expuesto directamente (solo a través de Nginx)
- [ ] El puerto 5432 (PostgreSQL) NO está expuesto al exterior

### Operación
- [ ] Backup automático configurado
- [ ] Sabés cómo ver los logs: `docker compose -f docker-compose.prod.yml logs -f app`
- [ ] Sabés cómo actualizar: `git pull` + `docker compose up -d --build app migrate`

---

## Notas adicionales

### Firewall (UFW)

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 2500/tcp     # Bloquear acceso directo a la app (solo via Nginx)
sudo ufw deny 5432/tcp     # Bloquear PostgreSQL al exterior
sudo ufw enable
sudo ufw status
```

### El servicio `migrate` sale con código 0 — ¿es normal?

Sí. El servicio `migrate` está diseñado para ejecutar `prisma migrate deploy` y terminar. Eso es correcto. Si ves `exited (0)`, las migraciones se aplicaron con éxito.

### ¿Qué pasa si hay una migración nueva en el código?

Al hacer `git pull` y `docker compose up -d --build app migrate`, el servicio `migrate` corre automáticamente antes de que la app reinicie y aplica las migraciones nuevas.

### Los archivos subidos por usuarios ¿dónde están?

En el volumen Docker `inventory-api_app_storage`. Está montado en `/app/storage` dentro del contenedor. Nunca se pierden al reiniciar la app, pero sí al hacer `docker compose down -v`. Por eso es importante el backup del volumen (ver sección 10).
