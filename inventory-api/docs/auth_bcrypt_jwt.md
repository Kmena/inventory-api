# bcrypt + JWT: requisitos y funcionamiento

## ¿Qué es bcrypt?

`bcrypt` se usa para **hashear contraseñas**.

Eso significa que la contraseña del usuario **no se guarda en texto plano**. En vez de guardar:

```text
admin123
```

se guarda un hash irreversible parecido a esto:

```text
$2b$12$...
```

## ¿Cómo funciona bcrypt?

1. el usuario envía su contraseña
2. el backend genera un hash con `bcrypt.hash()`
3. el hash se guarda en la base de datos
4. cuando el usuario inicia sesión, el backend compara con `bcrypt.compare()`

## ¿Qué se necesita para bcrypt?

- instalar la librería `bcrypt`
- definir `BCRYPT_ROUNDS` en variables de entorno

Ejemplo:

```env
BCRYPT_ROUNDS=12
```

### ¿Qué significa rounds?

Es el costo de procesamiento del hash.

- más alto = más seguro
- más alto = más lento

Valor recomendado para este proyecto:
- `10` a `12` en desarrollo o producción moderada

---

## ¿Qué es JWT?

`JWT` significa **JSON Web Token**.

Es un token firmado que el backend entrega después del login para que el cliente pueda autenticarse en las siguientes peticiones.

## ¿Cómo funciona JWT?

1. el usuario hace login con username/password
2. el backend valida la contraseña con bcrypt
3. si todo está bien, el backend genera un token JWT
4. el cliente guarda ese token
5. el cliente lo envía en cada request protegida:

```http
Authorization: Bearer <token>
```

6. el backend valida el token y permite o niega acceso

---

## ¿Qué se necesita para JWT?

- instalar `jsonwebtoken`
- definir un secreto fuerte en variables de entorno
- definir expiración del token

Ejemplo:

```env
JWT_SECRET=change_this_super_secret_key
JWT_EXPIRES_IN=8h
```

## Requisitos prácticos para que esto funcione bien

### 1. secreto seguro
El `JWT_SECRET` debe ser largo, aleatorio y privado.

No se debe:
- subir al repositorio
- dejar en texto visible en producción
- reutilizar uno obvio

### 2. HTTPS en producción
Si el token viaja por HTTP plano, se puede interceptar. Muy mala idea.

### 3. expiración razonable
No dejar tokens eternos.

Ejemplos razonables:
- `2h`
- `8h`
- `1d`

### 4. proteger rutas
No basta con generar el token. Hay que validar `Authorization: Bearer ...` en rutas privadas.

---

## ¿bcrypt y JWT hacen lo mismo?

No.

### bcrypt
Protege la **contraseña almacenada**.

### JWT
Protege el **acceso a la API después del login**.

Uno no reemplaza al otro.

---

## Flujo completo

1. crear usuario
2. hashear password con bcrypt
3. guardar usuario en PostgreSQL
4. hacer login
5. comparar password con bcrypt
6. generar JWT si es correcta
7. usar JWT para acceder a rutas protegidas

---

## Qué quedó hecho en esta plantilla

- hash de contraseña al crear usuarios
- login con validación de password
- emisión de JWT
- middleware para proteger rutas
- endpoint `GET /api/auth/me` para inspeccionar token actual
