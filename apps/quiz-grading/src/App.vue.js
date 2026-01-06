import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useStorage } from '@vueuse/core';
const token = useStorage('iai-token', '');
const tenantId = useStorage('iai-tenant', 'default');
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/grading';
const assignmentName = ref('');
const subject = ref('');
const assignments = ref([]);
const submissions = ref([]);
const loading = ref(false);
const message = ref('');
function appendTokenToUrl(url) {
    try {
        const u = new URL(url);
        if (token.value)
            u.searchParams.set('auth_token', token.value);
        if (tenantId.value)
            u.searchParams.set('tenant', tenantId.value);
        return u.toString();
    }
    catch (e) {
        return url;
    }
}
async function fetchAssignments() {
    loading.value = true;
    message.value = '';
    try {
        const res = await fetch(`${API_BASE}/assignments`, {
            headers: {
                Authorization: token.value ? `Bearer ${token.value}` : '',
                'x-tenant-id': tenantId.value
            }
        });
        assignments.value = res.ok ? await res.json() : [];
    }
    catch (e) {
        message.value = e.message || '获取作业列表失败';
    }
    finally {
        loading.value = false;
    }
}
async function createAssignment() {
    if (!assignmentName.value || !subject.value) {
        message.value = '请填写作业名称和学科';
        return;
    }
    loading.value = true;
    message.value = '';
    try {
        const res = await fetch(`${API_BASE}/assignments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token.value ? `Bearer ${token.value}` : '',
                'x-tenant-id': tenantId.value
            },
            body: JSON.stringify({ name: assignmentName.value, subject: subject.value })
        });
        if (!res.ok)
            throw new Error('创建失败，请检查 token 或后端');
        assignmentName.value = '';
        subject.value = '';
        await fetchAssignments();
        message.value = '已创建作业，可以继续上传标准答案或录入成绩';
    }
    catch (e) {
        message.value = e.message || '创建失败';
    }
    finally {
        loading.value = false;
    }
}
async function fetchSubmissions() {
    loading.value = true;
    message.value = '';
    try {
        const res = await fetch(`${API_BASE}/submissions`, {
            headers: {
                Authorization: token.value ? `Bearer ${token.value}` : '',
                'x-tenant-id': tenantId.value
            }
        });
        submissions.value = res.ok ? await res.json() : [];
    }
    catch (e) {
        message.value = e.message || '获取提交记录失败';
    }
    finally {
        loading.value = false;
    }
}
onMounted(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const tenant = params.get('tenant');
    if (authToken)
        token.value = authToken;
    if (tenant)
        tenantId.value = tenant;
    fetchAssignments();
    fetchSubmissions();
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:checkbox-marked-outline",
    width: "22",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:checkbox-marked-outline",
    width: "22",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "badge" },
});
const __VLS_4 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
    icon: "mdi:rocket-launch",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:rocket-launch",
}, ...__VLS_functionalComponentArgsRest(__VLS_5));
__VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "small" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    href: (__VLS_ctx.appendTokenToUrl('http://localhost:5173')),
    target: "_blank",
    rel: "noreferrer",
    ...{ class: "badge" },
    ...{ style: {} },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:view-dashboard",
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:view-dashboard",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
const __VLS_12 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
    icon: "mdi:form-select",
}));
const __VLS_14 = __VLS_13({
    icon: "mdi:form-select",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input" },
    placeholder: "如：七年级上·期末卷",
});
(__VLS_ctx.assignmentName);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input" },
    placeholder: "如：数学",
});
(__VLS_ctx.subject);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.createAssignment) },
    ...{ class: "primary" },
    disabled: (__VLS_ctx.loading),
    ...{ style: {} },
});
(__VLS_ctx.loading ? '提交中...' : '创建');
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "small" },
});
if (__VLS_ctx.message) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "small" },
        ...{ style: {} },
    });
    (__VLS_ctx.message);
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
const __VLS_16 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    icon: "mdi:list-status",
}));
const __VLS_18 = __VLS_17({
    icon: "mdi:list-status",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "list" },
});
for (const [item] of __VLS_getVForSourceType((__VLS_ctx.assignments))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (item.id),
        ...{ class: "list-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    (item.name);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
    });
    (item.subject);
    (item.status);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "status-pill" },
        ...{ class: (item.status?.toLowerCase() || 'processing') },
    });
    (item.status || 'PROCESSING');
}
if (!__VLS_ctx.assignments.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "card" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
const __VLS_20 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
    icon: "mdi:account-check-outline",
}));
const __VLS_22 = __VLS_21({
    icon: "mdi:account-check-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_21));
__VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
    ...{ class: "small" },
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "list" },
});
for (const [s] of __VLS_getVForSourceType((__VLS_ctx.submissions))) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (s.id),
        ...{ class: "list-item" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ style: {} },
    });
    (s.student?.name || '学生');
    (s.student?.class);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
    });
    (s.student?.studentId);
    (s.status);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
    });
    (s.totalScore);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "status-pill" },
        ...{ class: (s.status?.toLowerCase() || 'pending') },
    });
    (s.status);
    if (s.grading) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "small" },
            ...{ style: {} },
        });
        (s.grading.details);
    }
}
if (!__VLS_ctx.submissions.length) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
    });
}
/** @type {__VLS_StyleScopedClasses['container']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['badge']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
/** @type {__VLS_StyleScopedClasses['list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['status-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['list']} */ ;
/** @type {__VLS_StyleScopedClasses['list-item']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['status-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            assignmentName: assignmentName,
            subject: subject,
            assignments: assignments,
            submissions: submissions,
            loading: loading,
            message: message,
            appendTokenToUrl: appendTokenToUrl,
            createAssignment: createAssignment,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
