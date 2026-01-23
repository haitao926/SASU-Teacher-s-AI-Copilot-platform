import { ref, reactive } from 'vue';
import { Icon } from '@iconify/vue';
import { useStorage } from '@vueuse/core';
import StudentSelector from './StudentSelector.vue';
import StudentAnswerSheet from './StudentAnswerSheet.vue';
const token = useStorage('iai-token', '');
const tenantId = useStorage('iai-tenant', 'default');
// Remove /quizzes if present to get base API url
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes').replace('/quizzes', '');
const layout = ref({
    title: '期中考试答题卡',
    paperSize: 'A4',
    sections: [
        { id: 's1', type: 'choice', title: '选择题', count: 10, options: 4, content: '' },
        { id: 's2', type: 'blank', title: '填空题', count: 5, content: '' },
        { id: 's3', type: 'comprehensive', title: '综合题', count: 2, content: '' },
        { id: 's4', type: 'essay', title: '作文', count: 1, content: '' }
    ]
});
const selectedStudents = ref([]);
const activeTab = ref('design');
const previewSheetRef = ref(null);
const isSaving = ref(false);
const saveMessage = ref('');
const showStudentModal = ref(false);
// Modal state
const showModal = ref(false);
const modalForm = reactive({
    id: '',
    type: 'choice',
    title: '',
    count: 5,
    options: 4,
    content: '',
    lines: 5
});
const isEditing = ref(false);
// Maps type to icon
const typeIcons = {
    choice: 'mdi:checkbox-marked-circle-outline',
    judge: 'mdi:check-circle-outline',
    blank: 'mdi:form-textbox',
    calculation: 'mdi:calculator-variant-outline',
    comprehensive: 'mdi:text-box-outline',
    'short-answer': 'mdi:format-list-text',
    essay: 'mdi:file-document-edit-outline'
};
const typeLabels = {
    choice: '选择题', judge: '判断题', blank: '填空题', essay: '作文', comprehensive: '综合题', 'short-answer': '简答题', calculation: '计算题'
};
function openAddModal(type) {
    isEditing.value = false;
    modalForm.id = '';
    modalForm.type = type;
    modalForm.title = typeLabels[type];
    modalForm.count = (type === 'comprehensive' || type === 'essay') ? 1 : 5;
    modalForm.options = 4;
    modalForm.content = '';
    modalForm.lines = 5;
    showModal.value = true;
}
function openEditModal(section, idx) {
    isEditing.value = true;
    modalForm.id = section.id;
    modalForm.type = section.type;
    modalForm.title = section.title;
    modalForm.count = section.count;
    modalForm.options = section.options || 4;
    modalForm.content = section.content || '';
    modalForm.lines = section.lines || 5;
    showModal.value = true;
}
function confirmModal() {
    if (isEditing.value) {
        const idx = layout.value.sections.findIndex(s => s.id === modalForm.id);
        if (idx !== -1) {
            layout.value.sections[idx] = {
                ...layout.value.sections[idx],
                title: modalForm.title,
                count: modalForm.count,
                options: modalForm.options,
                content: modalForm.content,
                lines: modalForm.lines
            };
        }
    }
    else {
        layout.value.sections.push({
            id: Date.now().toString(),
            type: modalForm.type,
            title: modalForm.title,
            count: modalForm.count,
            options: modalForm.options,
            content: modalForm.content,
            lines: modalForm.lines
        });
    }
    showModal.value = false;
}
function removeSection(idx) {
    if (confirm('确定删除此区域吗？')) {
        layout.value.sections.splice(idx, 1);
    }
}
function print() {
    window.print();
}
async function saveLayout() {
    if (!token.value) {
        alert('请先登录后操作');
        return;
    }
    if (previewSheetRef.value) {
        const data = previewSheetRef.value.getLayoutData();
        if (!data)
            return;
        isSaving.value = true;
        saveMessage.value = '';
        try {
            const res = await fetch(`${API_BASE}/assets`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token.value}`,
                    'x-tenant-id': tenantId.value
                },
                body: JSON.stringify({
                    title: layout.value.title + ' (答题卡模板)',
                    type: 'answer-sheet',
                    content: JSON.stringify(data),
                    visibility: 'PRIVATE',
                    metadata: {
                        layout: layout.value,
                        paperSize: layout.value.paperSize
                    }
                })
            });
            if (!res.ok)
                throw new Error('保存失败');
            saveMessage.value = '✅ 保存成功！';
            setTimeout(() => saveMessage.value = '', 3000);
        }
        catch (e) {
            alert('保存失败: ' + e.message);
        }
        finally {
            isSaving.value = false;
        }
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['field-group']} */ ;
/** @type {__VLS_StyleScopedClasses['student-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn-main']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn-main']} */ ;
/** @type {__VLS_StyleScopedClasses['side-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['side-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['structure-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-del']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-card']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['designer']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "designer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "settings-bar no-print" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bar-left" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "field-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:format-title",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:format-title",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input slim" },
    placeholder: "请输入标题",
    ...{ style: {} },
});
(__VLS_ctx.layout.title);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "field-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:file-outline",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:file-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.layout.paperSize),
    ...{ class: "input slim" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "A4",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "A3",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "field-group separator" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "field-group" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:account-group-outline",
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:account-group-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showStudentModal = true;
        } },
    ...{ class: "student-btn" },
});
(__VLS_ctx.selectedStudents.length);
const __VLS_12 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    icon: "mdi:chevron-down",
}));
const __VLS_14 = __VLS_13({
    icon: "mdi:chevron-down",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "bar-right" },
});
if (__VLS_ctx.saveMessage) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "success-tag" },
    });
    (__VLS_ctx.saveMessage);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.saveLayout) },
    ...{ class: "action-btn-main outline" },
    disabled: (__VLS_ctx.isSaving),
});
const __VLS_16 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    icon: "mdi:cloud-upload",
}));
const __VLS_18 = __VLS_17({
    icon: "mdi:cloud-upload",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
if (__VLS_ctx.activeTab === 'print') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.print) },
        ...{ class: "action-btn-main primary" },
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: "mdi:printer",
    }));
    const __VLS_22 = __VLS_21({
        icon: "mdi:printer",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mode-switch" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'design';
        } },
    ...{ class: ({ active: __VLS_ctx.activeTab === 'design' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.activeTab = 'print';
        } },
    ...{ class: ({ active: __VLS_ctx.activeTab === 'print' }) },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "workspace no-print" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'design') }, null, null);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "side-panel left-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
(__VLS_ctx.layout.sections.length);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "structure-list" },
});
for (const [sec, idx] of __VLS_getVForSourceType((__VLS_ctx.layout.sections))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openEditModal(sec, idx);
            } },
        key: (sec.id),
        ...{ class: "structure-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "item-icon" },
    });
    const __VLS_24 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        icon: (__VLS_ctx.typeIcons[sec.type]),
    }));
    const __VLS_26 = __VLS_25({
        icon: (__VLS_ctx.typeIcons[sec.type]),
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "item-info" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "item-title" },
    });
    (idx + 1);
    (sec.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "item-meta" },
    });
    (sec.count);
    if (sec.type === 'choice') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
        (sec.options);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.removeSection(idx);
            } },
        ...{ class: "item-del" },
    });
    const __VLS_28 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
        icon: "mdi:close",
    }));
    const __VLS_30 = __VLS_29({
        icon: "mdi:close",
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
}
if (__VLS_ctx.layout.sections.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "empty-tip" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "preview-stage" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "stage-scroller" },
});
if (__VLS_ctx.selectedStudents.length > 0) {
    /** @type {[typeof StudentAnswerSheet, ]} */ ;
    // @ts-ignore
    const __VLS_32 = __VLS_asFunctionalComponent(StudentAnswerSheet, new StudentAnswerSheet({
        ref: "previewSheetRef",
        student: (__VLS_ctx.selectedStudents[0]),
        layout: (__VLS_ctx.layout),
        ...{ class: "preview-sheet" },
    }));
    const __VLS_33 = __VLS_32({
        ref: "previewSheetRef",
        student: (__VLS_ctx.selectedStudents[0]),
        layout: (__VLS_ctx.layout),
        ...{ class: "preview-sheet" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_32));
    /** @type {typeof __VLS_ctx.previewSheetRef} */ ;
    var __VLS_35 = {};
    var __VLS_34;
}
else {
    /** @type {[typeof StudentAnswerSheet, ]} */ ;
    // @ts-ignore
    const __VLS_37 = __VLS_asFunctionalComponent(StudentAnswerSheet, new StudentAnswerSheet({
        ref: "previewSheetRef",
        student: ({ id: 'demo', name: '张三 (示例)', studentId: '20230001', class: '七年级1班' }),
        layout: (__VLS_ctx.layout),
        ...{ class: "preview-sheet" },
    }));
    const __VLS_38 = __VLS_37({
        ref: "previewSheetRef",
        student: ({ id: 'demo', name: '张三 (示例)', studentId: '20230001', class: '七年级1班' }),
        layout: (__VLS_ctx.layout),
        ...{ class: "preview-sheet" },
    }, ...__VLS_functionalComponentArgsRest(__VLS_37));
    /** @type {typeof __VLS_ctx.previewSheetRef} */ ;
    var __VLS_40 = {};
    var __VLS_39;
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "side-panel right-panel" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "panel-header" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "tools-grid" },
});
for (const [label, type] of __VLS_getVForSourceType((__VLS_ctx.typeLabels))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openAddModal(type);
            } },
        key: (type),
        ...{ class: "tool-tile" },
    });
    const __VLS_42 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_43 = __VLS_asFunctionalComponent(__VLS_42, new __VLS_42({
        icon: (__VLS_ctx.typeIcons[type]),
        width: "24",
    }));
    const __VLS_44 = __VLS_43({
        icon: (__VLS_ctx.typeIcons[type]),
        width: "24",
    }, ...__VLS_functionalComponentArgsRest(__VLS_43));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({});
    (label);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "print-view" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow)(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.activeTab === 'print') }, null, null);
if (__VLS_ctx.selectedStudents.length === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "no-print" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ style: {} },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    for (const [student] of __VLS_getVForSourceType((__VLS_ctx.selectedStudents))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (student.id),
            ...{ class: "print-page" },
        });
        /** @type {[typeof StudentAnswerSheet, ]} */ ;
        // @ts-ignore
        const __VLS_46 = __VLS_asFunctionalComponent(StudentAnswerSheet, new StudentAnswerSheet({
            student: (student),
            layout: (__VLS_ctx.layout),
        }));
        const __VLS_47 = __VLS_46({
            student: (student),
            layout: (__VLS_ctx.layout),
        }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    }
}
if (__VLS_ctx.showModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    (__VLS_ctx.isEditing ? '编辑' : '添加');
    (__VLS_ctx.typeLabels[__VLS_ctx.modalForm.type]);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
            } },
        ...{ class: "close-btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        ...{ class: "input" },
    });
    (__VLS_ctx.modalForm.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
        value: (__VLS_ctx.modalForm.content),
        ...{ class: "input" },
        rows: "3",
        placeholder: "在此输入题目文本...",
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-row" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "form-group" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
        type: "number",
        ...{ class: "input" },
    });
    (__VLS_ctx.modalForm.count);
    if (['short-answer', 'comprehensive', 'calculation'].includes(__VLS_ctx.modalForm.type)) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            type: "number",
            ...{ class: "input" },
        });
        (__VLS_ctx.modalForm.lines);
    }
    if (__VLS_ctx.modalForm.type === 'choice') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "radio-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input, __VLS_intrinsicElements.input)({
            type: "radio",
            value: (4),
        });
        (__VLS_ctx.modalForm.options);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input, __VLS_intrinsicElements.input)({
            type: "radio",
            value: (5),
        });
        (__VLS_ctx.modalForm.options);
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-footer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showModal))
                    return;
                __VLS_ctx.showModal = false;
            } },
        ...{ class: "secondary" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.confirmModal) },
        ...{ class: "primary" },
    });
}
if (__VLS_ctx.showStudentModal) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-overlay" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-card wide" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-header" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showStudentModal))
                    return;
                __VLS_ctx.showStudentModal = false;
            } },
        ...{ class: "close-btn" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-body" },
    });
    /** @type {[typeof StudentSelector, ]} */ ;
    // @ts-ignore
    const __VLS_49 = __VLS_asFunctionalComponent(StudentSelector, new StudentSelector({
        modelValue: (__VLS_ctx.selectedStudents),
    }));
    const __VLS_50 = __VLS_49({
        modelValue: (__VLS_ctx.selectedStudents),
    }, ...__VLS_functionalComponentArgsRest(__VLS_49));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "modal-footer" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showStudentModal))
                    return;
                __VLS_ctx.showStudentModal = false;
            } },
        ...{ class: "primary" },
    });
    (__VLS_ctx.selectedStudents.length);
}
/** @type {__VLS_StyleScopedClasses['designer']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-bar']} */ ;
/** @type {__VLS_StyleScopedClasses['no-print']} */ ;
/** @type {__VLS_StyleScopedClasses['bar-left']} */ ;
/** @type {__VLS_StyleScopedClasses['field-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['slim']} */ ;
/** @type {__VLS_StyleScopedClasses['field-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['slim']} */ ;
/** @type {__VLS_StyleScopedClasses['field-group']} */ ;
/** @type {__VLS_StyleScopedClasses['separator']} */ ;
/** @type {__VLS_StyleScopedClasses['field-group']} */ ;
/** @type {__VLS_StyleScopedClasses['student-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['bar-right']} */ ;
/** @type {__VLS_StyleScopedClasses['success-tag']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn-main']} */ ;
/** @type {__VLS_StyleScopedClasses['outline']} */ ;
/** @type {__VLS_StyleScopedClasses['action-btn-main']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mode-switch']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['no-print']} */ ;
/** @type {__VLS_StyleScopedClasses['side-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['left-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['structure-list']} */ ;
/** @type {__VLS_StyleScopedClasses['structure-item']} */ ;
/** @type {__VLS_StyleScopedClasses['item-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['item-info']} */ ;
/** @type {__VLS_StyleScopedClasses['item-title']} */ ;
/** @type {__VLS_StyleScopedClasses['item-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['item-del']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-tip']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-stage']} */ ;
/** @type {__VLS_StyleScopedClasses['stage-scroller']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-sheet']} */ ;
/** @type {__VLS_StyleScopedClasses['side-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['right-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['tools-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['print-view']} */ ;
/** @type {__VLS_StyleScopedClasses['no-print']} */ ;
/** @type {__VLS_StyleScopedClasses['print-page']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-card']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-row']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['radio-group']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-overlay']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-header']} */ ;
/** @type {__VLS_StyleScopedClasses['close-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-body']} */ ;
/** @type {__VLS_StyleScopedClasses['modal-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
// @ts-ignore
var __VLS_36 = __VLS_35, __VLS_41 = __VLS_40;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            StudentSelector: StudentSelector,
            StudentAnswerSheet: StudentAnswerSheet,
            layout: layout,
            selectedStudents: selectedStudents,
            activeTab: activeTab,
            previewSheetRef: previewSheetRef,
            isSaving: isSaving,
            saveMessage: saveMessage,
            showStudentModal: showStudentModal,
            showModal: showModal,
            modalForm: modalForm,
            isEditing: isEditing,
            typeIcons: typeIcons,
            typeLabels: typeLabels,
            openAddModal: openAddModal,
            openEditModal: openEditModal,
            confirmModal: confirmModal,
            removeSection: removeSection,
            print: print,
            saveLayout: saveLayout,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
