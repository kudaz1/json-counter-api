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
        const jsonData = req.body;

        // Validar que se envíe un JSON válido
        if (!jsonData || typeof jsonData !== 'object') {
            return res.status(400).json({
                error: 'Se requiere un objeto JSON válido en el cuerpo de la petición'
            });
        }

        // Procesar el JSON y contar elementos
        const result = countElementsAtSameLevel(jsonData);

        res.json({
            success: true,
            data: result,
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
            'POST /count-elements - Procesar JSON y contar elementos',
            'GET /test - Probar con JSON de ejemplo',
            'GET /health - Verificar estado de la API'
        ]
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

