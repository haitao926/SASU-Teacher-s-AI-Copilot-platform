import * as pdfjsLib from 'pdfjs-dist';
export async function pdfToImages(file, onProgress) {
    const arrayBuffer = await file.arrayBuffer();
    // Directly use the promise, keeping the object completely out of Vue's scope
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages;
    const results = [];
    for (let i = 1; i <= totalPages; i++) {
        onProgress(i, totalPages);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx)
            continue;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        results.push({
            dataUrl,
            pageIndex: i
        });
        // Cleanup
        // page.cleanup() // Optional, depending on memory
    }
    return results;
}
