const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Middleware para manejar tanto JSON como texto plano de forma más simple
app.use('/count-elements', express.raw({ type: '*/*', limit: '10mb' }));

// Middleware JSON para otros endpoints
app.use(express.json({ limit: '10mb' }));

/**
 * Función simple para convertir texto plano a JSON válido
 * Versión optimizada para evitar problemas de memoria
 * @param {string} inputString - String en formato de entrada
 * @returns {Object} - Objeto JSON válido
 */
function convertTextToJson(inputString) {
    try {
        // Si ya es un objeto, devolverlo
        if (typeof inputString === 'object') {
            return inputString;
        }

        // Si no es string, error
        if (typeof inputString !== 'string') {
            throw new Error('Input debe ser string');
        }

        // Limpiar el string
        let str = inputString.trim();
        
        // Si no empieza con {, agregarlo
        if (!str.startsWith('{')) {
            str = '{' + str + '}';
        }

        // Conversión simple y segura
        let jsonString = str;
        
        // Paso 1: Reemplazar = con : de forma simple
        jsonString = jsonString.replace(/=/g, ':');
        
        // Paso 2: Agregar comillas a las keys (solo las que no las tienen)
        jsonString = jsonString.replace(/([a-zA-Z0-9_-]+):/g, '"$1":');
        
        // Paso 3: Agregar comillas a valores simples (muy básico)
        jsonString = jsonString.replace(/:\s*([^"{}\[\],\s][^,}]*?)(?=[,}])/g, (match, value) => {
            value = value.trim();
            // Si ya tiene comillas o es un número, no hacer nada
            if (value.startsWith('"') || /^\d+$/.test(value)) {
                return match;
            }
            // Agregar comillas
            return ': "' + value + '"';
        });

        // Paso 4: Limpiar problemas básicos
        jsonString = jsonString
            .replace(/""/g, '"')
            .replace(/:\s*"/g, ': "')
            .replace(/"\s*:/g, '":');

        // Paso 5: Parsear
        try {
            return JSON.parse(jsonString);
        } catch (parseError) {
            // Si falla, devolver un objeto básico con el conteo directo
            console.log('Conversión JSON falló, usando conteo directo desde string');
            return countFromStringDirect(inputString);
        }

    } catch (error) {
        console.log('Error en conversión, usando conteo directo:', error.message);
        return countFromStringDirect(inputString);
    }
}

/**
 * Función para parsear elementos al mismo nivel (hermanos) en un string
 * @param {string} content - Contenido del objeto
 * @returns {Array} - Array de elementos hermanos
 */
function parseElementsAtSameLevel(content) {
    const elements = [];
    let currentElement = '';
    let braceCount = 0;
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if (inString) {
            if (char === stringChar) {
                inString = false;
            }
            currentElement += char;
        } else if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            currentElement += char;
        } else if (char === '{') {
            braceCount++;
            currentElement += char;
        } else if (char === '}') {
            braceCount--;
            currentElement += char;
        } else if (char === ',' && braceCount === 0) {
            // Fin de un elemento hermano
            const element = parseElement(currentElement.trim());
            if (element && !isSystemProperty(element.name)) {
                elements.push(element);
            }
            currentElement = '';
        } else {
            currentElement += char;
        }
    }
    
    // Procesar el último elemento
    if (currentElement.trim()) {
        const element = parseElement(currentElement.trim());
        if (element && !isSystemProperty(element.name)) {
            elements.push(element);
        }
    }
    
    return elements;
}

/**
 * Función para parsear un elemento individual
 * @param {string} elementStr - String del elemento
 * @returns {Object|null} - Objeto con nombre y tipo del elemento
 */
function parseElement(elementStr) {
    const equalIndex = elementStr.indexOf('=');
    if (equalIndex === -1) return null;
    
    const name = elementStr.substring(0, equalIndex).trim();
    const value = elementStr.substring(equalIndex + 1).trim();
    
    // Determinar el tipo basado en el contenido
    let type = 'unknown';
    if (value.includes('Type=Job') || value.includes('Type=Job:')) {
        type = 'job';
    } else if (value.includes('eventsToAdd') || value.includes('eventsToWaitFor') || value.includes('eventsToDelete')) {
        type = 'event';
    } else if (value.includes('Type=')) {
        type = 'object';
    }
    
    return { name, type, value };
}

/**
 * Función para determinar si una propiedad es del sistema (no debe contarse)
 * @param {string} name - Nombre de la propiedad
 * @returns {boolean} - True si es propiedad del sistema
 */
function isSystemProperty(name) {
    const systemProps = [
        'Type', 'ControlmServer', 'OrderMethod', 'CreatedBy', 'Description', 
        'RunAs', 'Application', 'SubApplication', 'Priority', 'FileName', 
        'Host', 'FilePath', 'Variables', 'RerunSpecificTimes', 'When', 'Rerun'
    ];
    return systemProps.includes(name) || name.startsWith('IfBase:');
}

/**
 * Función de fallback para encontrar elementos con regex
 * @param {string} content - Contenido del objeto
 * @returns {Array} - Array de elementos encontrados
 */
function findElementsWithRegex(content) {
    const elements = [];
    
    // Buscar jobs con diferentes patrones
    const jobPatterns = [
        /([A-Za-z0-9_-]+-[A-Za-z0-9_-]*)\s*=\s*\{[^}]*Type\s*=\s*Job[^}]*\}/g,
        /([A-Za-z0-9_-]+-[A-Za-z0-9_-]*)\s*=\s*\{[^}]*Type\s*=\s*Job:[^}]*\}/g,
        /([A-Za-z0-9_-]+-[A-Za-z0-9_-]*)\s*=\s*\{[^}]*Type\s*=\s*Job:Script[^}]*\}/g
    ];
    
    // Buscar eventos
    const eventPatterns = [
        /(eventsToAdd)\s*=\s*\{[^}]*\}/g,
        /(eventsToWaitFor)\s*=\s*\{[^}]*\}/g,
        /(eventsToDelete)\s*=\s*\{[^}]*\}/g
    ];
    
    // Buscar jobs
    jobPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const name = match[1];
            if (name && !isSystemProperty(name)) {
                elements.push({ name, type: 'job' });
            }
        }
    });
    
    // Buscar eventos
    eventPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const name = match[1];
            if (name && !isSystemProperty(name)) {
                elements.push({ name, type: 'event' });
            }
        }
    });
    
    // Eliminar duplicados
    const uniqueElements = elements.filter((element, index, self) => 
        index === self.findIndex(e => e.name === element.name)
    );
    
    return uniqueElements;
}

/**
 * Función de conteo directo desde string (sin regex complejos)
 * @param {string} inputString - String de entrada
 * @returns {Object} - Resultado del conteo
 */
function countFromStringDirect(inputString) {
    try {
        // Buscar OrderMethod=Manual
        if (!inputString.includes('OrderMethod') || !inputString.includes('Manual')) {
            return {
                found: false,
                count: 0,
                elementNames: [],
                message: 'No se encontró ningún elemento con OrderMethod: "Manual"'
            };
        }

        // Encontrar la posición de OrderMethod=Manual
        const orderMethodPos = inputString.indexOf('OrderMethod=Manual');
        if (orderMethodPos === -1) {
            return {
                found: false,
                count: 0,
                elementNames: [],
                message: 'No se encontró OrderMethod=Manual en el string'
            };
        }

        // Buscar el objeto que contiene OrderMethod=Manual
        let objectStart = inputString.lastIndexOf('{', orderMethodPos);
        if (objectStart === -1) {
            return {
                found: false,
                count: 0,
                elementNames: [],
                message: 'No se encontró el inicio del objeto con OrderMethod=Manual'
            };
        }

        // Encontrar el final del objeto que contiene OrderMethod=Manual
        let objectEnd = orderMethodPos;
        let braceCount = 0;
        
        console.log('Debug - Searching for object end starting from position:', orderMethodPos);
        console.log('Debug - Input string length:', inputString.length);
        
        for (let i = orderMethodPos; i < inputString.length; i++) {
            if (inputString[i] === '{') braceCount++;
            if (inputString[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    objectEnd = i;
                    console.log('Debug - Found object end at position:', objectEnd);
                    break;
                }
            }
        }
        
        console.log('Debug - Object boundaries:', {
            start: objectStart,
            end: objectEnd,
            orderMethodPos: orderMethodPos,
            contentLength: objectEnd - objectStart
        });

        // Extraer solo el contenido del objeto que tiene OrderMethod=Manual
        const objectContent = inputString.slice(objectStart + 1, objectEnd);
        
        // Debug: mostrar el contenido del objeto para análisis
        console.log('Debug - Contenido del objeto (primeros 500 chars):', objectContent.substring(0, 500));
        console.log('Debug - Contenido del objeto (últimos 500 chars):', objectContent.substring(Math.max(0, objectContent.length - 500)));
        
        // Método inteligente: buscar elementos hermanos (al mismo nivel que OrderMethod=Manual)
        // Dividir el contenido por comas, pero respetando objetos anidados
        const elements = parseElementsAtSameLevel(objectContent);
        
        console.log('Debug - Elementos hermanos encontrados:', elements.length);
        elements.forEach((element, index) => {
            console.log(`  Elemento ${index + 1}: ${element.name} (${element.type})`);
        });
        
        // Si no encontramos elementos con el método inteligente, usar método de respaldo
        let elementNames = [];
        if (elements.length === 0) {
            console.log('No elements found with intelligent method, trying fallback regex method');
            const fallbackElements = findElementsWithRegex(objectContent);
            console.log('Debug - Fallback elements found:', fallbackElements.length);
            fallbackElements.forEach((element, index) => {
                console.log(`  Fallback Element ${index + 1}: ${element.name} (${element.type})`);
            });
            elementNames = fallbackElements.map(el => el.name);
        } else {
            console.log('Using intelligent method results, but checking if we should also try fallback');
            elementNames = elements.map(el => el.name);
            
            // Si encontramos pocos elementos, también probar el método de fallback
            if (elements.length < 2) {
                console.log('Few elements found with intelligent method, also trying fallback method');
                const fallbackElements = findElementsWithRegex(objectContent);
                console.log('Debug - Fallback elements found:', fallbackElements.length);
                fallbackElements.forEach((element, index) => {
                    console.log(`  Fallback Element ${index + 1}: ${element.name} (${element.type})`);
                });
                
                // Combinar ambos métodos y eliminar duplicados
                const allElements = [...elements];
                fallbackElements.forEach(fallbackEl => {
                    if (!allElements.find(el => el.name === fallbackEl.name)) {
                        allElements.push(fallbackEl);
                    }
                });
                
                console.log('Debug - Combined elements:', allElements.length);
                elementNames = allElements.map(el => el.name);
            }
        }
        
        return {
            found: true,
            count: elementNames.length,
            elementNames: elementNames,
            message: `Se encontraron ${elementNames.length} elementos al mismo nivel que el elemento con OrderMethod: "Manual"`
        };
        
    } catch (error) {
        return {
            found: false,
            count: 0,
            elementNames: [],
            message: 'Error procesando el formato de entrada'
        };
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
            // Excluir solo propiedades del sistema/metadata básicas, contar elementos de trabajo
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    // Excluir solo propiedades del sistema/metadata básicas
                    if (key !== 'Type' && key !== 'ControlmServer' && key !== 'OrderMethod' && 
                        key !== 'CreatedBy' && key !== 'Description' && key !== 'RunAs' && 
                        key !== 'Application' && key !== 'SubApplication' && key !== 'Priority' &&
                        key !== 'FileName' && key !== 'Host' && key !== 'FilePath' &&
                        key !== 'Variables' && key !== 'RerunSpecificTimes' && key !== 'When' &&
                        key !== 'Rerun' && !key.startsWith('IfBase:')) {
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

    // Iniciar búsqueda recursiva
    findOrderMethodElement(jsonData);

    // Preparar resultado
    if (foundOrderMethod) {
        return {
            found: true,
            count: count,
            elementNames: elementNames,
            message: `Se encontraron ${count} elementos al mismo nivel que el elemento con OrderMethod: "Manual"`
        };
    } else {
        return {
            found: false,
            count: 0,
            elementNames: [],
            message: 'No se encontró ningún elemento con OrderMethod: "Manual"'
        };
    }
}

// Endpoint para mostrar información de la API
app.get('/', (req, res) => {
    res.json({
        message: 'API para contar elementos al mismo nivel que OrderMethod: Manual',
        version: '1.0.0',
        endpoints: {
            'POST /count-elements': 'Contar elementos al mismo nivel que el elemento con OrderMethod: "Manual"',
            'GET /health': 'Verificar estado de la API'
        },
        usage: {
            method: 'POST',
            url: '/count-elements',
            headers: [
                { 'Content-Type': 'application/json' },
                { 'Content-Type': 'text/plain' }
            ],
            body: {
                description: 'Acepta tanto JSON válido como texto plano en formato {key=value}',
                examples: {
                    json: {
                        'Test-Carlos-MallaError': {
                            'Type': 'Folder',
                            'OrderMethod': 'Manual',
                            'test1': {
                                'Type': 'Job:Command',
                                'Command': 'echo "Hola mundo"'
                            },
                            'Select_Tabla': {
                                'Type': 'Job:Database:SQLScript',
                                'SQLScript': 'SELECT * FROM tabla'
                            }
                        }
                    },
                    text: '{Test-Carlos-MallaError={Type=Folder, OrderMethod=Manual, test1={Type=Job:Command, Command=echo "Hola mundo"}, Select_Tabla={Type=Job:Database:SQLScript, SQLScript=SELECT * FROM tabla}}}'
                }
            }
        },
        response: {
            success: true,
            data: {
                found: true,
                count: 2,
                elementNames: ['test1', 'Select_Tabla'],
                message: 'Se encontraron 2 elementos al mismo nivel que el elemento con OrderMethod: "Manual"'
            }
        }
    });
});

// Endpoint principal para procesar JSON
app.post('/count-elements', (req, res) => {
    try {
        // Configurar timeout más largo para Jira
        req.setTimeout(30000); // 30 segundos
        res.setTimeout(30000);

        // Debug: capturar información completa de la solicitud
        console.log('=== DEBUG REQUEST ===');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Content-Type:', req.get('Content-Type'));
        console.log('Body type:', typeof req.body);
        console.log('Body length:', req.body ? req.body.length : 0);
        console.log('Body preview (first 500 chars):', req.body ? req.body.toString().substring(0, 500) : 'No body');
        console.log('Body preview (last 500 chars):', req.body ? req.body.toString().substring(Math.max(0, req.body.toString().length - 500)) : 'No body');

        let inputData = req.body;
        let convertedJson = null;

        // Si recibimos un Buffer, convertirlo a string
        if (Buffer.isBuffer(inputData)) {
            inputData = inputData.toString('utf8');
            console.log('Converted Buffer to string, length:', inputData.length);
        }

        // Detectar si el contenido es formato de texto plano aunque venga como JSON
        const isTextFormat = typeof inputData === 'string' && inputData.includes('=') && inputData.includes('{') && !inputData.trim().startsWith('{');
        
        if (typeof inputData === 'string' || isTextFormat) {
            try {
                // Si es formato de texto plano, usar conteo directo
                if (isTextFormat || !inputData.trim().startsWith('{')) {
                    console.log('Detected text format, using direct count method');
                    const directResult = countFromStringDirect(inputData);
                    console.log('Direct count result:', directResult);
                    
                    const response = {
                        success: true,
                        data: directResult,
                        convertedFromText: true,
                        method: 'direct_count',
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log('Sending response:', JSON.stringify(response, null, 2));
                    return res.json(response);
                }
                
                // Intentar parsear como JSON primero
                try {
                    inputData = JSON.parse(inputData);
                } catch (jsonError) {
                    // Si no es JSON válido, usar conteo directo desde string
                    console.log('JSON parsing failed, using direct count method for string input');
                    const directResult = countFromStringDirect(inputData);
                    console.log('Direct count result:', directResult);
                    
                    const response = {
                        success: true,
                        data: directResult,
                        convertedFromText: true,
                        method: 'direct_count',
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log('Sending response:', JSON.stringify(response, null, 2));
                    return res.json(response);
                }
            } catch (error) {
                // Si hay cualquier error, usar conteo directo como fallback
                console.log('Error in string processing, using fallback:', error.message);
                const directResult = countFromStringDirect(inputData);
                console.log('Fallback count result:', directResult);
                
                const response = {
                    success: true,
                    data: directResult,
                    convertedFromText: true,
                    method: 'direct_count_fallback',
                    timestamp: new Date().toISOString()
                };
                
                console.log('Sending fallback response:', JSON.stringify(response, null, 2));
                return res.json(response);
            }
        }

        // Validar que tengamos un objeto JSON válido
        if (!inputData || typeof inputData !== 'object') {
            return res.status(400).json({
                error: 'Se requiere un objeto JSON válido o string en formato de entrada en el cuerpo de la petición',
                receivedType: typeof inputData,
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
            convertedFromText: convertedJson ? true : false,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error procesando entrada:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint de prueba con ejemplo
app.get('/test', (req, res) => {
    const exampleJson = {
        'Test-Carlos-MallaError': {
            'Type': 'Folder',
            'ControlmServer': 'COOPEUCH_DESA',
            'OrderMethod': 'Manual',
            'SubApplication': 'Test-Carlos-MallaError',
            'Application': 'Test-Carlos-MallaError',
            'test1': {
                'Type': 'Job:Command',
                'SubApplication': 'Test-Carlos-MallaError',
                'Host': 'controlms1de01',
                'RunAs': 'controlm',
                'Application': 'Test-Carlos-MallaError',
                'Command': 'echo "Hola mundo"',
                'eventsToAdd': {
                    'Type': 'AddEvents',
                    'Events': [
                        { 'Event': 'test1-TO-Select_Tabla' }
                    ]
                }
            },
            'Select_Tabla': {
                'Type': 'Job:Database:SQLScript',
                'SQLScript': 'SELECT * FROM tabla',
                'ConnectionProfile': 'nombre_del_perfil_conexion',
                'SubApplication': 'Test-Carlos-MallaError',
                'RunAs': 'nombre_del_perfil_conexion',
                'Application': 'Test-Carlos-MallaError',
                'eventsToWaitFor': {
                    'Type': 'WaitForEvents',
                    'Events': [
                        { 'Event': 'test1-TO-Select_Tabla' }
                    ]
                },
                'eventsToAdd': {
                    'Type': 'AddEvents',
                    'Events': [
                        { 'Event': 'Select_Tabla-TO-test2' }
                    ]
                },
                'eventsToDelete': {
                    'Type': 'DeleteEvents',
                    'Events': [
                        { 'Event': 'test1-TO-Select_Tabla' }
                    ]
                }
            },
            'test2': {
                'Type': 'Job:Command',
                'SubApplication': 'Test-Carlos-MallaError',
                'Host': 'controlms1de01',
                'RunAs': 'controlm',
                'Application': 'Test-Carlos-MallaError',
                'Command': 'echo "Hola mundo"',
                'eventsToWaitFor': {
                    'Type': 'WaitForEvents',
                    'Events': [
                        { 'Event': 'Select_Tabla-TO-test2' }
                    ]
                },
                'eventsToDelete': {
                    'Type': 'DeleteEvents',
                    'Events': [
                        { 'Event': 'Select_Tabla-TO-test2' }
                    ]
                }
            }
        }
    };

    const result = countElementsAtSameLevel(exampleJson);

    res.json({
        message: 'Prueba de la API con ejemplo',
        exampleJson: exampleJson,
        result: result,
        timestamp: new Date().toISOString()
    });
});

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Endpoint simple para probar que Jira puede comunicarse
app.post('/test-jira', (req, res) => {
    console.log('=== JIRA TEST ENDPOINT ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', req.body);
    
    res.json({
        success: true,
        message: 'Jira communication test successful',
        receivedData: req.body,
        timestamp: new Date().toISOString()
    });
});

// Manejar rutas no encontradas
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint no encontrado',
        message: 'La ruta solicitada no existe',
        availableEndpoints: [
            'GET / - Información de la API',
            'POST /count-elements - Contar elementos',
            'GET /test - Prueba con ejemplo',
            'GET /health - Estado de la API'
        ],
        timestamp: new Date().toISOString()
    });
});

// Configurar el servidor con timeouts más largos para Jira
const server = app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Endpoint principal: POST http://localhost:${PORT}/count-elements`);
    console.log(`🧪 Endpoint de prueba: GET http://localhost:${PORT}/test`);
    console.log(`❤️  Endpoint de salud: GET http://localhost:${PORT}/health`);
});

// Configurar timeouts del servidor para Jira
server.timeout = 30000; // 30 segundos
server.keepAliveTimeout = 30000;
server.headersTimeout = 35000;

module.exports = app;