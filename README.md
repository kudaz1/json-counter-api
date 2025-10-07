# JSON Counter API

API REST para contar elementos al mismo nivel que un elemento con `"OrderMethod": "Manual"` en un JSON.

## Descripción

Esta API permite enviar un JSON y obtener el conteo de elementos que están al mismo nivel que el elemento que contiene `"OrderMethod": "Manual"`. La API busca recursivamente en todo el JSON hasta encontrar el elemento con esta propiedad y luego cuenta los otros elementos que están en el mismo nivel.

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Ejecutar el servidor:
```bash
npm start
```

Para desarrollo con auto-reload:
```bash
npm run dev
```

## Uso

### Endpoint Principal: POST /count-elements

Envía un JSON en el cuerpo de la petición para procesarlo.

**URL:** `http://localhost:3000/count-elements`

**Método:** POST

**Headers:**
```
Content-Type: application/json
```

**Ejemplo de petición:**
```bash
curl -X POST http://localhost:3000/count-elements \
  -H "Content-Type: application/json" \
  -d '{
    "36_REMANENTE_HISTORICO": {
      "Type": "SimpleFolder",
      "ControlmServer": "COOPEUCH_DESA",
      "OrderMethod": "Manual",
      "36_REMANENTE_HISTORICO-001-DIA-CRM": {
        "Type": "Job:Script",
        "SubApplication": "36_REMANENTE_HISTORICO"
      },
      "36_REMANENTE_HISTORICO-002-DIA-CRM": {
        "Type": "Job:Script",
        "SubApplication": "36_REMANENTE_HISTORICO"
      }
    }
  }'
```

**Ejemplo de respuesta:**
```json
{
  "success": true,
  "data": {
    "found": true,
    "count": 2,
    "elementNames": [
      "36_REMANENTE_HISTORICO-001-DIA-CRM",
      "36_REMANENTE_HISTORICO-002-DIA-CRM"
    ],
    "message": "Se encontraron 2 elementos al mismo nivel que el elemento con OrderMethod: \"Manual\""
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Endpoint de Prueba: GET /test

Prueba la API con un JSON de ejemplo predefinido.

**URL:** `http://localhost:3000/test`

**Método:** GET

### Endpoint de Salud: GET /health

Verifica que la API esté funcionando correctamente.

**URL:** `http://localhost:3000/health`

**Método:** GET

## Lógica de Conteo

La API funciona de la siguiente manera:

1. **Búsqueda recursiva**: Recorre todo el JSON buscando elementos que contengan la propiedad `"OrderMethod": "Manual"`

2. **Identificación del nivel**: Una vez encontrado el elemento con `OrderMethod: "Manual"`, identifica su objeto padre

3. **Conteo de elementos**: Cuenta todos los elementos en el mismo nivel que sean objetos (excluyendo el elemento con `OrderMethod`)

4. **Resultado**: Devuelve el número de elementos encontrados junto con sus nombres

## Estructura de Respuesta

```json
{
  "success": boolean,
  "data": {
    "found": boolean,           // Si se encontró el elemento con OrderMethod: "Manual"
    "count": number,            // Número de elementos al mismo nivel
    "elementNames": string[],   // Nombres de los elementos encontrados
    "message": string           // Mensaje descriptivo del resultado
  },
  "timestamp": string           // Timestamp de la respuesta
}
```

## Manejo de Errores

La API maneja los siguientes casos de error:

- **400 Bad Request**: JSON inválido o faltante
- **500 Internal Server Error**: Error interno del servidor

## Ejemplo con el JSON Completo

Para el JSON de ejemplo que proporcionaste, la API encontrará:
- **Elemento con OrderMethod: "Manual"**: `36_REMANENTE_HISTORICO`
- **Elementos al mismo nivel**: 2 elementos
  - `36_REMANENTE_HISTORICO-001-DIA-CRM`
  - `36_REMANENTE_HISTORICO-002-DIA-CRM`

## Configuración

- **Puerto**: 3000 (configurable con variable de entorno PORT)
- **Límite de JSON**: 10MB
- **CORS**: Habilitado para todas las rutas

## Dependencias

- **express**: Framework web para Node.js
- **cors**: Middleware para habilitar CORS
- **nodemon**: Para desarrollo con auto-reload (dev dependency)


