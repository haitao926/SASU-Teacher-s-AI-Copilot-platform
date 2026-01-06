import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useStorage } from '@vueuse/core';
const token = useStorage('iai-token', '');
const tenantId = useStorage('iai-tenant', 'default');
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes';
const topic = ref('二次函数及应用');
const knowledge = ref('函数性质, 图像, 极值点');
const difficulty = ref('medium');
const result = ref(null);
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
async function generate() {
    loading.value = true;
    message.value = '';
    try {
        const res = await fetch(`${API_BASE}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token.value ? `Bearer ${token.value}` : '',
                'x-tenant-id': tenantId.value
            },
            body: JSON.stringify({
                topic: topic.value,
                knowledgePoints: knowledge.value.split(/[,，]/).map((v) => v.trim()).filter(Boolean),
                difficulty: difficulty.value,
                outlineOnly: false
            })
        });
        if (!res.ok)
            throw new Error('生成失败，请检查 token 或后端接口');
        result.value = await res.json();
        message.value = '已生成试卷草稿，可在下方复制/导出';
    }
    catch (e) {
        message.value = e.message || '生成失败';
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
    icon: "mdi:file-document-edit",
    width: "22",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:file-document-edit",
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
    icon: "mdi:lightbulb-on",
}));
const __VLS_6 = __VLS_5({
    icon: "mdi:lightbulb-on",
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
    icon: "mdi:tune-variant",
}));
const __VLS_14 = __VLS_13({
    icon: "mdi:tune-variant",
}, ...__VLS_functionalComponentArgsRest(__VLS_13));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input" },
    placeholder: "如：函数综合测试",
});
(__VLS_ctx.topic);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
    ...{ class: "input" },
    placeholder: "如：二次函数, 取值范围",
});
(__VLS_ctx.knowledge);
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
__VLS_asFunctionalElement(__VLS_intrinsicElements.select, __VLS_intrinsicElements.select)({
    ...{ class: "input" },
    value: (__VLS_ctx.difficulty),
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "easy",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "medium",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.option, __VLS_intrinsicElements.option)({
    value: "hard",
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ style: {} },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.generate) },
    ...{ class: "primary" },
    disabled: (__VLS_ctx.loading),
    ...{ style: {} },
});
(__VLS_ctx.loading ? '生成中...' : '生成试卷');
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
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "section-title" },
});
const __VLS_16 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
    icon: "mdi:file-eye-outline",
}));
const __VLS_18 = __VLS_17({
    icon: "mdi:file-eye-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "small" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    (__VLS_ctx.result.id || 'draft');
    (__VLS_ctx.result.questions?.length || 0);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
}
if (__VLS_ctx.result) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
    (JSON.stringify(__VLS_ctx.result, null, 2));
}
else {
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
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['card']} */ ;
/** @type {__VLS_StyleScopedClasses['section-title']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
/** @type {__VLS_StyleScopedClasses['small']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            topic: topic,
            knowledge: knowledge,
            difficulty: difficulty,
            result: result,
            loading: loading,
            message: message,
            appendTokenToUrl: appendTokenToUrl,
            generate: generate,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
