// Test local para verificar el conteo
const fs = require('fs');

// Leer el archivo server.js y extraer las funciones
const serverContent = fs.readFileSync('server.js', 'utf8');

// Extraer la función countFromStringDirect
const functionMatch = serverContent.match(/function countFromStringDirect\([\s\S]*?\n}/);
if (!functionMatch) {
    console.error('No se pudo extraer la función countFromStringDirect');
    process.exit(1);
}

// Ejecutar solo la función
eval(functionMatch[0]);

// Test con tu entrada real (versión simplificada para prueba)
const testInput = `{36_REMANENTE_HISTORICO={Type=SimpleFolder, ControlmServer=COOPEUCH_DESA, OrderMethod=Manual, 36_REMANENTE_HISTORICO-001-DIA-CRM={Type=Job:Script, SubApplication=36_REMANENTE_HISTORICO, Priority=Very Low, FileName=buscarRemanenteHistorico.bat, Host=crm, FilePath=c:\\controlm\\CRM_2016\\exec\\36_Remanente_Historico, CreatedBy=emuser, Description=36_REMANENTE_HISTORICO, RunAs=controlm, Application=36_REMANENTE_HISTORICO, Variables=[{tm=%%TIME}, {HHt=%%SUBSTR %%tm 1 2}, {MMt=%%SUBSTR %%tm 3 2}, {SSt=%%SUBSTR %%tm 5 2}, {HORA=%%HHt:%%MMt:%%SSt}], RerunSpecificTimes={At=[0900, 1200, 1500, 1900]}, When={WeekDays=[MON, TUE, WED, THU, FRI], MonthDays=[NONE], DaysRelation=OR, ConfirmationCalendars={Calendar=Cal_Habil}}, IfBase:Folder:CompletionStatus_5={Type=If:CompletionStatus, CompletionStatus=!=0, Action:SetToNotOK_0={Type=Action:SetToNotOK}, Mail_1={Type=Action:Mail, Subject=%%APPLIC (%%APPLGROUP - %%JOBNAME) ERROR_PROCESO, To=controlmerror@coopeuch.cl, Message=Estimado, informo a Ud. que el job %%JOBNAME y proceso detallado en el asunto de este mail, finalizó incorrectamente. Además, se registra el promedio del tiempo de ejecución(en segundos) y hora de termino del proceso: %%AVG_TIME - %%DAY/%%MONTH/%%$YEAR %%HORA\\n\\nAtte.\\n\\nOperador de Sistema.\\n\\n\\n, AttachOutput=false}}, eventsToAdd={Type=AddEvents, Events=[{Event=36_REMANENTE_HISTORICO-001-DIA-CRM}]}}, 36_REMANENTE_HISTORICO-002-DIA-CRM={Type=Job:Script, SubApplication=36_REMANENTE_HISTORICO, Priority=Very Low, FileName=Historicoremanente.bat, Host=crm, FilePath=c:\\controlm\\CRM_2016\\exec\\36_Remanente_Historico, CreatedBy=emuser, Description=36_REMANENTE_HISTORICO, RunAs=controlm, Application=36_REMANENTE_HISTORICO, Variables=[{tm=%%TIME}, {HHt=%%SUBSTR %%tm 1 2}, {MMt=%%SUBSTR %%tm 3 2}, {SSt=%%SUBSTR %%tm 5 2}, {HORA=%%HHt:%%MMt:%%SSt}], Rerun={Times=99, Units=Minutes, Every=0}, When={WeekDays=[MON, TUE, WED, THU, FRI], MonthDays=[NONE], DaysRelation=OR, ConfirmationCalendars={Calendar=Cal_Habil}}, IfBase:Folder:CompletionStatus_5={Type=If:CompletionStatus, CompletionStatus=!=0, Action:SetToNotOK_0={Type=Action:SetToNotOK}, Mail_1={Type=Action:Mail, Subject=%%APPLIC (%%APPLGROUP - %%JOBNAME) ERROR_PROCESO, To=controlmerror@coopeuch.cl, Message=Estimado, informo a Ud. que el job %%JOBNAME y proceso detallado en el asunto de este mail, finalizó incorrectamente. Además, se registra el promedio del tiempo de ejecución(en segundos) y hora de termino del proceso: %%AVG_TIME - %%DAY/%%MONTH/%%$YEAR %%HORA\\n\\nAtte.\\n\\nOperador de Sistema.\\n, AttachOutput=false}}, eventsToWaitFor={Type=WaitForEvents, Events=[{Event=36_REMANENTE_HISTORICO-001-DIA-CRM}]}, eventsToDelete={Type=DeleteEvents, Events=[{Event=36_REMANENTE_HISTORICO-002-DIA-CRM}]}}}}`;

console.log('🧪 Probando conteo local...');
console.log('📥 Input length:', testInput.length);

try {
    const result = countFromStringDirect(testInput);
    
    console.log('\n📊 Resultado del conteo:');
    console.log('- Encontrado OrderMethod Manual:', result.found);
    console.log('- Cantidad de elementos:', result.count);
    console.log('- Nombres de elementos:', result.elementNames);
    console.log('- Mensaje:', result.message);
    
    // Debug: mostrar qué está encontrando exactamente
    console.log('\n🔍 Debug - Análisis detallado:');
    
    // Buscar OrderMethod=Manual
    const orderMethodPos = testInput.indexOf('OrderMethod=Manual');
    console.log('- Posición de OrderMethod=Manual:', orderMethodPos);
    
    // Buscar el objeto que contiene OrderMethod=Manual
    let objectStart = testInput.lastIndexOf('{', orderMethodPos);
    console.log('- Inicio del objeto:', objectStart);
    
    // Encontrar el final del objeto
    let objectEnd = orderMethodPos;
    let braceCount = 0;
    
    for (let i = orderMethodPos; i < testInput.length; i++) {
        if (testInput[i] === '{') braceCount++;
        if (testInput[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                objectEnd = i;
                break;
            }
        }
    }
    
    console.log('- Final del objeto:', objectEnd);
    
    // Extraer el contenido del objeto
    const objectContent = testInput.slice(objectStart + 1, objectEnd);
    console.log('- Contenido del objeto (primeros 200 chars):', objectContent.substring(0, 200) + '...');
    
    // Buscar todos los jobs en el contenido del objeto
    const jobMatches = objectContent.match(/[A-Za-z0-9_-]+-[A-Za-z0-9_-]*\s*=\s*\{[^}]*Type\s*=\s*Job[^}]*\}/g);
    console.log('- Jobs encontrados:', jobMatches ? jobMatches.length : 0);
    if (jobMatches) {
        jobMatches.forEach((match, index) => {
            const keyMatch = match.match(/^([A-Za-z0-9_-]+)/);
            console.log(`  ${index + 1}. ${keyMatch ? keyMatch[1] : 'Sin nombre'}`);
        });
    }
    
    // Buscar eventos
    const eventMatches = objectContent.match(/(eventsToAdd|eventsToWaitFor|eventsToDelete)\s*=\s*\{[^}]*\}/g);
    console.log('- Eventos encontrados:', eventMatches ? eventMatches.length : 0);
    if (eventMatches) {
        eventMatches.forEach((match, index) => {
            const keyMatch = match.match(/^(eventsToAdd|eventsToWaitFor|eventsToDelete)/);
            console.log(`  ${index + 1}. ${keyMatch ? keyMatch[1] : 'Sin nombre'}`);
        });
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
}
