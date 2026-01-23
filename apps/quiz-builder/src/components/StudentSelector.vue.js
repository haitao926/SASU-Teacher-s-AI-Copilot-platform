import { ref, onMounted, computed } from 'vue';
import { useStorage } from '@vueuse/core';
const props = defineProps();
const emit = defineEmits();
const token = useStorage('iai-token', '');
const tenantId = useStorage('iai-tenant', 'default');
// Remove /quizzes if present to get base API url
const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes').replace('/quizzes', '');
const students = ref([]);
const loading = ref(false);
const error = ref('');
const selectedClass = ref('');
// Fetch students
async function fetchStudents() {
    loading.value = true;
    error.value = '';
    try {
        const res = await fetch(`${API_BASE}/admin/students?pageSize=200`, {
            headers: {
                Authorization: token.value ? `Bearer ${token.value}` : '',
                'x-tenant-id': tenantId.value
            }
        });
        if (!res.ok)
            throw new Error('获取学生名单失败，请检查是否登录或权限');
        const data = await res.json();
        students.value = data.items || [];
    }
    catch (e) {
        error.value = e.message;
        // Fallback mock data for dev if no auth
        if (!token.value) {
            students.value = [
                { id: '1', name: '张三', studentId: '2023001', class: '七年级1班' },
                { id: '2', name: '李四', studentId: '2023002', class: '七年级1班' },
                { id: '3', name: '王五', studentId: '2023003', class: '七年级2班' },
                { id: '4', name: '赵六', studentId: '2023004', class: '七年级2班' },
                { id: '5', name: '钱七', studentId: '2023005', class: '七年级3班' },
                { id: '6', name: '孙八', studentId: '2023006', class: '七年级3班' }
            ];
        }
    }
    finally {
        loading.value = false;
    }
}
// Filter classes
const classes = computed(() => {
    const s = new Set(students.value.map(s => s.class).filter(Boolean));
    return Array.from(s).sort();
});
const filteredStudents = computed(() => {
    if (!selectedClass.value)
        return students.value;
    return students.value.filter(s => s.class === selectedClass.value);
});
function toggleSelection(student) {
    const newSelection = [...props.modelValue];
    const idx = newSelection.findIndex(s => s.id === student.id);
    if (idx > -1) {
        newSelection.splice(idx, 1);
    }
    else {
        newSelection.push(student);
    }
    emit('update:modelValue', newSelection);
}
function selectAll() {
    const currentIds = new Set(props.modelValue.map(s => s.id));
    const newSelection = [...props.modelValue];
    filteredStudents.value.forEach(s => {
        if (!currentIds.has(s.id)) {
            newSelection.push(s);
        }
    });
    emit('update:modelValue', newSelection);
}
function clearSelection() {
    emit('update:modelValue', []);
}
onMounted(() => {
    fetchStudents();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['student-card']} */ ;
/** @type {__VLS_StyleScopedClasses['student-card']} */ ;
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "student-selector" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "toolbar" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    value: (__VLS_ctx.selectedClass),
    ...{ class: "input" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "",
});
for (const [c] of __VLS_getVForSourceType((__VLS_ctx.classes))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
        key: (c),
        value: (c),
    });
    (c);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.fetchStudents) },
    disabled: (__VLS_ctx.loading),
    ...{ class: "btn" },
});
(__VLS_ctx.loading ? '刷新' : '刷新');
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "spacer" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.selectAll) },
    ...{ class: "btn primary" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.clearSelection) },
    ...{ class: "btn" },
});
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "error-msg" },
    });
    (__VLS_ctx.error);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "grid" },
});
for (const [s] of __VLS_getVForSourceType((__VLS_ctx.filteredStudents))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.toggleSelection(s);
            } },
        key: (s.id),
        ...{ class: "student-card" },
        ...{ class: ({ selected: __VLS_ctx.modelValue.some(sel => sel.id === s.id) }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "s-name" },
    });
    (s.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "s-meta" },
    });
    (s.studentId);
    (s.class);
    if (__VLS_ctx.modelValue.some(sel => sel.id === s.id)) {
        const __VLS_0 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            icon: "mdi:check-circle",
            ...{ class: "check-icon" },
        }));
        const __VLS_2 = __VLS_1({
            icon: "mdi:check-circle",
            ...{ class: "check-icon" },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    }
}
/** @type {__VLS_StyleScopedClasses['student-selector']} */ ;
/** @type {__VLS_StyleScopedClasses['toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['spacer']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['error-msg']} */ ;
/** @type {__VLS_StyleScopedClasses['grid']} */ ;
/** @type {__VLS_StyleScopedClasses['student-card']} */ ;
/** @type {__VLS_StyleScopedClasses['selected']} */ ;
/** @type {__VLS_StyleScopedClasses['s-name']} */ ;
/** @type {__VLS_StyleScopedClasses['s-meta']} */ ;
/** @type {__VLS_StyleScopedClasses['check-icon']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            loading: loading,
            error: error,
            selectedClass: selectedClass,
            fetchStudents: fetchStudents,
            classes: classes,
            filteredStudents: filteredStudents,
            toggleSelection: toggleSelection,
            selectAll: selectAll,
            clearSelection: clearSelection,
        };
    },
    __typeEmits: {},
    __typeProps: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
    __typeProps: {},
});
; /* PartiallyEnd: #4569/main.vue */
