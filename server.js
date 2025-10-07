const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                description: 'Objeto JSON con estructura que contenga OrderMethod: "Manual"',
                example: {
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
        const inputData = req.body;

        // Validar que tengamos un objeto JSON válido
        if (!inputData || typeof inputData !== 'object') {
            return res.status(400).json({
                error: 'Se requiere un objeto JSON válido en el cuerpo de la petición',
                receivedType: typeof inputData,
                acceptedFormat: 'application/json'
            });
        }

        // Procesar el JSON y contar elementos
        const result = countElementsAtSameLevel(inputData);

        res.json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error procesando JSON:', error);
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Endpoint principal: POST http://localhost:${PORT}/count-elements`);
    console.log(`🧪 Endpoint de prueba: GET http://localhost:${PORT}/test`);
    console.log(`❤️  Endpoint de salud: GET http://localhost:${PORT}/health`);
});

module.exports = app;