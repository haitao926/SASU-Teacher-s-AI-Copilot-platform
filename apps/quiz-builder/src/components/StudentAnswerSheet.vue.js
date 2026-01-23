import { onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
const props = defineProps();
const rootRef = ref(null);
const qrCanvas = ref(null);
// Expose the layout measurement function
const __VLS_exposed = {
    getLayoutData
};
defineExpose(__VLS_exposed);
async function generateQR() {
    if (qrCanvas.value && props.student.studentId) {
        try {
            await QRCode.toCanvas(qrCanvas.value, props.student.studentId, {
                width: 80,
                margin: 0,
                color: {
                    dark: '#000000',
                    light: '#ffffff00' // transparent background
                }
            });
        }
        catch (e) {
            console.error(e);
        }
    }
}
// Measure and return layout geometry
function getLayoutData() {
    if (!rootRef.value)
        return null;
    const rootRect = rootRef.value.getBoundingClientRect();
    const zones = [];
    // Helper to get relative coords
    const getRelRect = (el) => {
        const r = el.getBoundingClientRect();
        return {
            x: r.left - rootRect.left,
            y: r.top - rootRect.top,
            w: r.width,
            h: r.height
        };
    };
    // Find QR code position first (Anchor)
    let qrRect = { x: 0, y: 0, w: 0, h: 0 };
    if (qrCanvas.value) {
        qrRect = getRelRect(qrCanvas.value);
        zones.push({
            type: 'anchor',
            name: 'qrcode',
            rect: qrRect
        });
    }
    // Helper to get coords relative to QR Anchor (Top-Left)
    const getAnchorRelRect = (el) => {
        const rel = getRelRect(el);
        return {
            x: rel.x - qrRect.x,
            y: rel.y - qrRect.y,
            w: rel.w,
            h: rel.h
        };
    };
    // Find choice/judge bubbles (NOW they are Write-in areas, but we still track them as zones)
    const writeInItems = rootRef.value.querySelectorAll('.write-in-area');
    writeInItems.forEach((el) => {
        const qNum = el.getAttribute('data-q-num');
        if (qNum) {
            zones.push({
                qNum: parseInt(qNum),
                type: 'rect', // Changed from bubble to rect as it is handwriting area
                rect: getAnchorRelRect(el)
            });
        }
    });
    // Find fill-in-blank lines
    const blankLines = rootRef.value.querySelectorAll('.blank-line');
    blankLines.forEach((el) => {
        const qNum = el.getAttribute('data-q-num');
        if (qNum) {
            zones.push({
                qNum: parseInt(qNum),
                type: 'rect',
                rect: getAnchorRelRect(el)
            });
        }
    });
    // Find comprehensive/mixed/short-answer boxes
    const compBoxes = rootRef.value.querySelectorAll('.comprehensive-box');
    compBoxes.forEach((el) => {
        const qNum = el.getAttribute('data-q-num');
        if (qNum) {
            zones.push({
                qNum: parseInt(qNum),
                type: 'rect', // Treat as a large rect area for recognition/segmentation
                rect: getAnchorRelRect(el)
            });
        }
    });
    // Find calculation boxes
    const calcBoxes = rootRef.value.querySelectorAll('.calc-box');
    calcBoxes.forEach((el) => {
        const qNum = el.getAttribute('data-q-num');
        if (qNum) {
            zones.push({
                qNum: parseInt(qNum),
                type: 'rect',
                rect: getAnchorRelRect(el)
            });
        }
    });
    // Find essay box
    const essayBoxes = rootRef.value.querySelectorAll('.essay-box');
    essayBoxes.forEach((el, idx) => {
        const sectionTitle = el.closest('.section')?.querySelector('.section-title')?.textContent;
        zones.push({
            type: 'essay',
            label: sectionTitle,
            rect: getAnchorRelRect(el)
        });
    });
    return {
        width: rootRect.width,
        height: rootRect.height,
        anchor: 'qrcode-top-left',
        zones
    };
}
// Helper to chunk questions into groups of 5
function chunkQuestions(count, size = 5) {
    const chunks = [];
    for (let i = 0; i < count; i += size) {
        chunks.push({
            start: i + 1,
            end: Math.min(i + size, count),
            items: Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k + 1)
        });
    }
    return chunks;
}
watch(() => props.student.id, generateQR);
onMounted(generateQR);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['answer-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['meta']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-line']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ref: "rootRef",
    ...{ class: "answer-sheet" },
    ...{ class: (__VLS_ctx.layout.paperSize) },
});
/** @type {typeof __VLS_ctx.rootRef} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "info" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ class: "title" },
});
(__VLS_ctx.layout.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "meta" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.u, __VLS_intrinsicElements.u)({});
(__VLS_ctx.student.class);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.u, __VLS_intrinsicElements.u)({});
(__VLS_ctx.student.name);
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.u, __VLS_intrinsicElements.u)({});
(__VLS_ctx.student.studentId);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "qr-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.canvas, __VLS_intrinsicElements.canvas)({
    ref: "qrCanvas",
});
/** @type {typeof __VLS_ctx.qrCanvas} */ ;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "qr-label" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "instructions" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "sections" },
});
for (const [section, idx] of __VLS_getVForSourceType((__VLS_ctx.layout.sections))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (section.id),
        ...{ class: "section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "section-title" },
    });
    (['一', '二', '三', '四', '五', '六'][idx]);
    (section.title);
    if (section.content) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "question-content" },
        });
        (section.content);
    }
    if (section.type === 'choice' || section.type === 'judge') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "omr-table-container" },
        });
        for (const [chunk, cIdx] of __VLS_getVForSourceType((__VLS_ctx.chunkQuestions(section.count, 5)))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (cIdx),
                ...{ class: "omr-group" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "omr-row header-row" },
            });
            for (const [qNum] of __VLS_getVForSourceType((chunk.items))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (qNum),
                    ...{ class: "omr-cell q-num-cell" },
                });
                (qNum);
            }
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "omr-row options-row" },
            });
            for (const [qNum] of __VLS_getVForSourceType((chunk.items))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (qNum),
                    ...{ class: "omr-cell options-cell" },
                });
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    ...{ class: "write-in-area" },
                    'data-q-num': (qNum),
                });
            }
        }
    }
    else if (section.type === 'blank') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "blank-grid" },
        });
        for (const [n] of __VLS_getVForSourceType((section.count))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (n),
                ...{ class: "blank-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "q-num" },
            });
            (n);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "blank-line" },
                'data-q-num': (n),
            });
        }
    }
    else if (section.type === 'calculation') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "calc-grid" },
        });
        for (const [n] of __VLS_getVForSourceType((section.count))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (n),
                ...{ class: "calc-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "calc-label" },
            });
            (n);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "calc-box" },
                'data-q-num': (n),
            });
        }
    }
    else if (section.type === 'short-answer') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "comp-grid" },
        });
        for (const [n] of __VLS_getVForSourceType((section.count))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (n),
                ...{ class: "comp-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "comp-label" },
            });
            (n);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "ruled-area comprehensive-box" },
                'data-q-num': (n),
            });
            for (const [line] of __VLS_getVForSourceType(((section.lines || 5)))) {
                __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                    key: (line),
                    ...{ class: "rule-line" },
                });
            }
        }
    }
    else if (section.type === 'comprehensive') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "comp-grid" },
        });
        for (const [n] of __VLS_getVForSourceType((section.count))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (n),
                ...{ class: "comp-item" },
            });
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "comp-label" },
            });
            (n);
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "comprehensive-box" },
                'data-q-num': (n),
                ...{ style: ({ height: (section.lines ? section.lines * 30 : 120) + 'px' }) },
            });
        }
    }
    else if (section.type === 'essay') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "essay-grid" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "essay-box" },
        });
        for (const [r] of __VLS_getVForSourceType((15))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                key: (r),
                ...{ class: "essay-row" },
            });
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "essay-count" },
        });
    }
}
/** @type {__VLS_StyleScopedClasses['answer-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['header']} */ ;
/** @type {__VLS_StyleScopedClasses['info']} */ ;
/** @type {__VLS_StyleScopedClasses['title']} */ ;
/** @type {__VLS_StyleScopedClasses['meta']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-container']} */ ;
/** @type {__VLS_StyleScopedClasses['qr-label']} */ ;
/** @type {__VLS_StyleScopedClasses['instructions']} */ ;
/** @type {__VLS_StyleScopedClasses['sections']} */ ;
/** @type {__VLS_StyleScopedClasses['section']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['question-content']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-table-container']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-group']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-row']} */ ;
/** @type {__VLS_StyleScopedClasses['header-row']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['q-num-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-row']} */ ;
/** @type {__VLS_StyleScopedClasses['options-row']} */ ;
/** @type {__VLS_StyleScopedClasses['omr-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['options-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['write-in-area']} */ ;
/** @type {__VLS_StyleScopedClasses['blank-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['blank-item']} */ ;
/** @type {__VLS_StyleScopedClasses['q-num']} */ ;
/** @type {__VLS_StyleScopedClasses['blank-line']} */ ;
/** @type {__VLS_StyleScopedClasses['calc-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['calc-item']} */ ;
/** @type {__VLS_StyleScopedClasses['calc-label']} */ ;
/** @type {__VLS_StyleScopedClasses['calc-box']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-item']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['ruled-area']} */ ;
/** @type {__VLS_StyleScopedClasses['comprehensive-box']} */ ;
/** @type {__VLS_StyleScopedClasses['rule-line']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-item']} */ ;
/** @type {__VLS_StyleScopedClasses['comp-label']} */ ;
/** @type {__VLS_StyleScopedClasses['comprehensive-box']} */ ;
/** @type {__VLS_StyleScopedClasses['essay-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['essay-box']} */ ;
/** @type {__VLS_StyleScopedClasses['essay-row']} */ ;
/** @type {__VLS_StyleScopedClasses['essay-count']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            rootRef: rootRef,
            qrCanvas: qrCanvas,
            chunkQuestions: chunkQuestions,
        };
    },
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
