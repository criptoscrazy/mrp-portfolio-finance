// Vendored official SheetJS CE 0.20.3. Parse untrusted workbooks away from the UI/session.
importScripts('vendor/xlsx-0.20.3.min.js');
self.onmessage=event=>{
  try {
    if(!(event.data instanceof ArrayBuffer)||event.data.byteLength>5*1024*1024)throw new Error('Libro inválido o mayor de 5 MB.');
    if(XLSX.version!=='0.20.3')throw new Error('Versión del lector no válida.');
    const book=XLSX.read(event.data,{type:'array',sheetRows:10002,bookVBA:false,cellFormula:false,cellHTML:false});
    if(!book.SheetNames.length)throw new Error('El libro no contiene hojas.');
    const sheet=book.Sheets[book.SheetNames[0]],range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
    if(range.e.r>=10001||range.e.c>=100)throw new Error('El libro supera los límites de 10.000 operaciones o 100 columnas.');
    const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:false});
    self.postMessage({rows});
  }catch(error){self.postMessage({error:error.message||'No se pudo procesar el libro.'});}
};
