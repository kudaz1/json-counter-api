const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' })); // Para recibir texto plano también

/**
 * Función para convertir formato de entrada a JSON válido
 * Convierte formato: {key=value, key2={subkey=value2}} a JSON válido
 * @param {string} inputString - String en formato de entrada
 * @returns {Object} - Objeto JSON válido
 */
function convertInputToJson(inputString) {
    try {
        // Si ya es un objeto JSON válido, lo devolvemos tal como está
        if (typeof inputString === 'object') {
            return inputString;
        }

        // Si es string, lo convertimos
        if (typeof inputString !== 'string') {
            throw new Error('Input debe ser string o objeto JSON');
        }

        // Limpiar el string
        let str = inputString.trim();
        
        // Si no empieza con {, agregarlo
        if (!str.startsWith('{')) {
            str = '{' + str + '}';
        }

        // Función principal de conversión usando regex más simple
        function convertToJson(input) {
            // Paso 1: Reemplazar = con : y agregar comillas a las keys
            let jsonString = input.replace(/([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/g, '"$1":');
            
            // Paso 2: Agregar comillas a valores simples (no objetos, arrays o strings ya entre comillas)
            jsonString = jsonString.replace(/:\s*([^"{}\[\],\s][^,}]*?)(?=[,}])/g, (match, value) => {
                value = value.trim();
                // Si ya tiene comillas, no hacer nada
                if (value.startsWith('"') && value.endsWith('"')) {
                    return match;
                }
                // Si es un número, booleano o null, no agregar comillas
                if (/^(true|false|null|\d+(\.\d+)?)$/.test(value)) {
                    return match;
                }
                // Si es un objeto o array, no agregar comillas
                if (value.startsWith('{') || value.startsWith('[')) {
                    return match;
                }
                // Agregar comillas
                return ': "' + value + '"';
            });
            
            // Paso 3: Manejar arrays
            jsonString = jsonString.replace(/\[([^\]]*)\]/g, (match, content) => {
                if (!content.trim()) return '[]';
                
                // Procesar elementos del array
                const items = [];
                let currentItem = '';
                let braceCount = 0;
                let inString = false;
                let stringChar = '';
                
                for (let i = 0; i < content.length; i++) {
                    const char = content[i];
                    
                    if (inString) {
                        if (char === stringChar) {
                            inString = false;
                        }
                        currentItem += char;
                    } else if (char === '"' || char === "'") {
                        inString = true;
                        stringChar = char;
                        currentItem += char;
                    } else if (char === '{') {
                        braceCount++;
                        currentItem += char;
                    } else if (char === '}') {
                        braceCount--;
                        currentItem += char;
                    } else if (char === ',' && braceCount === 0) {
                        items.push(currentItem.trim());
                        currentItem = '';
                    } else {
                        currentItem += char;
                    }
                }
                
                if (currentItem.trim()) {
                    items.push(currentItem.trim());
                }
                
                // Convertir cada elemento del array
                const jsonItems = items.map(item => {
                    item = item.trim();
                    if (item.startsWith('{')) {
                        return JSON.stringify(convertToJson(item));
                    } else if (!item.startsWith('"') && !/^(true|false|null|\d+(\.\d+)?)$/.test(item)) {
                        return '"' + item + '"';
                    }
                    return item;
                });
                
                return '[' + jsonItems.join(', ') + ']';
            });
            
            // Paso 4: Procesar objetos anidados recursivamente
            jsonString = jsonString.replace(/\{[^{}]*\}/g, (match) => {
                // Si ya tiene formato JSON (contiene ": "), devolverlo tal como está
                if (match.includes('": ')) {
                    return match;
                }
                // Si no, convertirlo recursivamente
                try {
                    const converted = convertToJson(match);
                    return JSON.stringify(converted);
                } catch (e) {
                    return match;
                }
            });
            
            // Paso 5: Parsear el JSON resultante
            try {
                return JSON.parse(jsonString);
            } catch (parseError) {
                // Si falla, intentar limpiar problemas comunes
                let cleaned = jsonString
                    .replace(/""/g, '"')  // Comillas dobles
                    .replace(/:\s*([^",}]+)(?=[,}])/g, ': "$1"')  // Valores sin comillas
                    .replace(/"\s*,\s*"/g, '", "')  // Espacios en comas
                    .replace(/\{\s*"/g, '{"')  // Espacios después de {
                    .replace(/"\s*\}/g, '"}')  // Espacios antes de }
                    // Manejar comillas anidadas en strings
                    .replace(/"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3"')
                    .replace(/"([^"]*)"([^"]*)"([^"]*)"([^"]*)"/g, '"$1\\"$2\\"$3\\"$4"');
                
                try {
                    return JSON.parse(cleaned);
                } catch (secondError) {
                    // Último intento: crear un parser manual simple
                    try {
                        return manualParse(jsonString);
                    } catch (manualError) {
                        throw new Error(`No se pudo convertir a JSON válido. String resultante: ${jsonString}`);
                    }
                }
            }
        }

        // Función de parsing manual como último recurso
        function manualParse(str) {
            try {
                // Intentar parsing recursivo mejorado
                return parseObjectRecursive(str);
            } catch (e) {
                // Si falla, usar parsing básico
                return parseObjectBasic(str);
            }
        }

        function parseObjectRecursive(input) {
            if (typeof input === 'object') return input;
            
            const result = {};
            
            // Limpiar input
            let str = input.trim();
            if (str.startsWith('{') && str.endsWith('}')) {
                str = str.slice(1, -1);
            }
            
            // Parsear propiedades
            const parts = [];
            let current = '';
            let braceCount = 0;
            let inString = false;
            let stringChar = '';
            
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                
                if (inString) {
                    if (char === stringChar) {
                        inString = false;
                    }
                    current += char;
                } else if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (char === '{') {
                    braceCount++;
                    current += char;
                } else if (char === '}') {
                    braceCount--;
                    current += char;
                } else if (char === ',' && braceCount === 0) {
                    parts.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            if (current.trim()) {
                parts.push(current.trim());
            }
            
            // Procesar cada parte
            parts.forEach(part => {
                const colonIndex = part.indexOf(':');
                if (colonIndex > 0) {
                    const key = part.substring(0, colonIndex).replace(/^"|"$/g, '').trim();
                    let value = part.substring(colonIndex + 1).trim();
                    
                    // Si el valor es un objeto anidado, parsearlo recursivamente
                    if (value.startsWith('{') && value.endsWith('}')) {
                        result[key] = parseObjectRecursive(value);
                    } else if (value.startsWith('[') && value.endsWith(']')) {
                        // Manejar arrays
                        result[key] = parseArray(value);
                    } else {
                        // Limpiar comillas del valor
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        result[key] = value;
                    }
                }
            });
            
            return result;
        }

        function parseArray(arrayStr) {
            const content = arrayStr.slice(1, -1).trim();
            if (!content) return [];
            
            const items = [];
            let currentItem = '';
            let braceCount = 0;
            let inString = false;
            let stringChar = '';
            
            for (let i = 0; i < content.length; i++) {
                const char = content[i];
                
                if (inString) {
                    if (char === stringChar) {
                        inString = false;
                    }
                    currentItem += char;
                } else if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    currentItem += char;
                } else if (char === '{') {
                    braceCount++;
                    currentItem += char;
                } else if (char === '}') {
                    braceCount--;
                    currentItem += char;
                } else if (char === ',' && braceCount === 0) {
                    items.push(parseObjectRecursive(currentItem.trim()));
                    currentItem = '';
                } else {
                    currentItem += char;
                }
            }
            
            if (currentItem.trim()) {
                items.push(parseObjectRecursive(currentItem.trim()));
            }
            
            return items;
        }

        function parseObjectBasic(str) {
            const result = {};
            
            // Remover llaves externas
            str = str.replace(/^\{|\}$/g, '');
            
            // Dividir por comas pero respetando objetos anidados
            const parts = [];
            let current = '';
            let braceCount = 0;
            let inString = false;
            let stringChar = '';
            
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                
                if (inString) {
                    if (char === stringChar) {
                        inString = false;
                    }
                    current += char;
                } else if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                    current += char;
                } else if (char === '{') {
                    braceCount++;
                    current += char;
                } else if (char === '}') {
                    braceCount--;
                    current += char;
                } else if (char === ',' && braceCount === 0) {
                    parts.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            
            if (current.trim()) {
                parts.push(current.trim());
            }
            
            // Procesar cada parte
            parts.forEach(part => {
                const colonIndex = part.indexOf(':');
                if (colonIndex > 0) {
                    const key = part.substring(0, colonIndex).replace(/^"|"$/g, '').trim();
                    let value = part.substring(colonIndex + 1).trim();
                    
                    // Limpiar comillas del valor
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    
                    result[key] = value;
                }
            });
            
            return result;
        }

        return convertToJson(str);

    } catch (error) {
        throw new Error(`Error convirtiendo formato de entrada: ${error.message}`);
    }
}

/**
 * Función para contar elementos al mismo nivel que el elemento con OrderMethod: "Manual"
 * @param {Object} jsonData - El objeto JSON a procesar
 * @returns {Object} - Objeto con el conteo y detalles
 */
function countElementsAtSameLevel(jsonData) {
    let count = 0;
    let foundOrderMethod = false;
    let elementNames = [];

    // Función recursiva para buscar el elemento con OrderMethod: "Manual"
    function findOrderMethodElement(obj) {
        if (typeof obj !== 'object' || obj === null) {
            return;
        }

        // Si encontramos OrderMethod: "Manual", contamos elementos en el mismo nivel
        if (obj.hasOwnProperty('OrderMethod') && obj.OrderMethod === 'Manual') {
            foundOrderMethod = true;
            
            // Contar elementos en el mismo nivel (dentro del objeto que tiene OrderMethod)
            // Excluir propiedades del sistema/metadata, contar solo elementos de trabajo
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    // Excluir propiedades del sistema/metadata, contar solo elementos de trabajo
                    if (key !== 'Type' && key !== 'ControlmServer' && key !== 'OrderMethod' && 
                        key !== 'CreatedBy' && key !== 'Description' && key !== 'RunAs' && 
                        key !== 'Application' && key !== 'SubApplication' && key !== 'Priority' &&
                        key !== 'FileName' && key !== 'Host' && key !== 'FilePath' &&
                        key !== 'Variables' && key !== 'RerunSpecificTimes' && key !== 'When' &&
                        key !== 'Rerun' && key !== 'eventsToAdd' && key !== 'eventsToWaitFor' &&
                        key !== 'eventsToDelete' && !key.startsWith('IfBase:')) {
                        count++;
                        elementNames.push(key);
                    }
                }
            }
            return;
        }

        // Buscar recursivamente en todos los objetos
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                findOrderMethodElement(value);
            }
        }
    }

    findOrderMethodElement(jsonData);

    return {
        found: foundOrderMethod,
        count: count,
        elementNames: elementNames,
        message: foundOrderMethod 
            ? `Se encontraron ${count} elementos al mismo nivel que el elemento con OrderMethod: "Manual"`
            : 'No se encontró ningún elemento con OrderMethod: "Manual"'
    };
}

// Endpoint principal para procesar JSON
app.post('/count-elements', (req, res) => {
    try {
        let inputData = req.body;

        // Si recibimos texto plano, lo convertimos
        if (typeof inputData === 'string') {
            try {
                inputData = convertInputToJson(inputData);
            } catch (conversionError) {
                return res.status(400).json({
                    error: 'Error convirtiendo formato de entrada',
                    details: conversionError.message,
                    receivedFormat: 'text/plain'
                });
            }
        }

        // Validar que tengamos datos válidos
        if (!inputData || (typeof inputData !== 'object' && typeof inputData !== 'string')) {
            return res.status(400).json({
                error: 'Se requiere un objeto JSON válido o string en formato de entrada en el cuerpo de la petición',
                acceptedFormats: [
                    'application/json - Objeto JSON válido',
                    'text/plain - String en formato {key=value, key2={subkey=value2}}'
                ]
            });
        }

        // Procesar el JSON y contar elementos
        const result = countElementsAtSameLevel(inputData);

        res.json({
            success: true,
            data: result,
            convertedJson: inputData, // Mostrar el JSON convertido
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error procesando JSON:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor al procesar el JSON',
            details: error.message
        });
    }
});

// Endpoint de prueba con el JSON de ejemplo
app.get('/test', (req, res) => {
    const exampleJson = {
        "36_REMANENTE_HISTORICO": {
            "Type": "SimpleFolder",
            "ControlmServer": "COOPEUCH_DESA",
            "OrderMethod": "Manual",
            "36_REMANENTE_HISTORICO-001-DIA-CRM": {
                "Type": "Job:Script",
                "SubApplication": "36_REMANENTE_HISTORICO",
                "Priority": "Very Low",
                "FileName": "buscarRemanenteHistorico.bat",
                "Host": "crm",
                "FilePath": "c:\\controlm\\CRM_2016\\exec\\36_Remanente_Historico",
                "CreatedBy": "emuser",
                "Description": "36_REMANENTE_HISTORICO",
                "RunAs": "controlm",
                "Application": "36_REMANENTE_HISTORICO"
            },
            "36_REMANENTE_HISTORICO-002-DIA-CRM": {
                "Type": "Job:Script",
                "SubApplication": "36_REMANENTE_HISTORICO",
                "Priority": "Very Low",
                "FileName": "Historicoremanente.bat",
                "Host": "crm",
                "FilePath": "c:\\controlm\\CRM_2016\\exec\\36_Remanente_Historico",
                "CreatedBy": "emuser",
                "Description": "36_REMANENTE_HISTORICO",
                "RunAs": "controlm",
                "Application": "36_REMANENTE_HISTORICO"
            }
        }
    };

    const result = countElementsAtSameLevel(exampleJson);
    
    res.json({
        success: true,
        data: result,
        exampleJson: exampleJson,
        timestamp: new Date().toISOString()
    });
});

// Endpoint para probar la conversión de formato
app.post('/convert-format', (req, res) => {
    try {
        const inputData = req.body;

        if (!inputData || typeof inputData !== 'string') {
            return res.status(400).json({
                error: 'Se requiere un string en formato de entrada',
                example: '{Test-Carlos-MallaError={Type=Folder, OrderMethod=Manual, test1={Type=Job:Command, Command=echo "Hola mundo"}}}'
            });
        }

        const convertedJson = convertInputToJson(inputData);

        res.json({
            success: true,
            originalInput: inputData,
            convertedJson: convertedJson,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error convirtiendo formato:', error);
        res.status(500).json({
            success: false,
            error: 'Error convirtiendo formato de entrada',
            details: error.message
        });
    }
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint no encontrado',
        availableEndpoints: [
            'POST /count-elements - Procesar JSON y contar elementos (acepta JSON o formato de entrada)',
            'POST /convert-format - Convertir formato de entrada a JSON válido',
            'GET /test - Probar con JSON de ejemplo',
            'GET /health - Verificar estado de la API'
        ]
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Endpoint principal: POST http://localhost:${PORT}/count-elements`);
    console.log(`🔄 Endpoint de conversión: POST http://localhost:${PORT}/convert-format`);
    console.log(`🧪 Endpoint de prueba: GET http://localhost:${PORT}/test`);
    console.log(`❤️  Endpoint de salud: GET http://localhost:${PORT}/health`);
});

module.exports = app;

