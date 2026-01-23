import { ref, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import { useStorage } from '@vueuse/core';
import AnswerSheetDesigner from './components/AnswerSheetDesigner.vue';
const token = useStorage('iai-token', '');
const tenantId = useStorage('iai-tenant', 'default');
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api/quizzes';
// Navigation State: 'dashboard' | 'quiz-gen' | 'answer-sheet'
const currentView = ref('dashboard');
// Quiz Gen State
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
// CSS variable injection 
// CSS variable injection end 
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "app-container" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.header, __VLS_intrinsicElements.header)({
    ...{ class: "global-header no-print" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "brand" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "logo-box" },
});
const __VLS_0 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    icon: "mdi:file-document-edit",
    width: "24",
}));
const __VLS_2 = __VLS_1({
    icon: "mdi:file-document-edit",
    width: "24",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "titles" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "main-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "sub-title" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "actions" },
});
if (__VLS_ctx.currentView !== 'dashboard') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.currentView !== 'dashboard'))
                    return;
                __VLS_ctx.currentView = 'dashboard';
            } },
        ...{ class: "nav-btn" },
    });
    const __VLS_4 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        icon: "mdi:view-grid-outline",
    }));
    const __VLS_6 = __VLS_5({
        icon: "mdi:view-grid-outline",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.a, __VLS_intrinsicElements.a)({
    href: (__VLS_ctx.appendTokenToUrl('http://localhost:5173')),
    target: "_blank",
    ...{ class: "nav-btn outline" },
});
const __VLS_8 = {}.Icon;
/** @type {[typeof __VLS_components.Icon, ]} */ ;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({
    icon: "mdi:home-export-outline",
}));
const __VLS_10 = __VLS_9({
    icon: "mdi:home-export-outline",
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
if (__VLS_ctx.currentView === 'dashboard') {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "dashboard fade-in" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "hero-section" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h1, __VLS_intrinsicElements.h1)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "cards-grid" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'dashboard'))
                    return;
                __VLS_ctx.currentView = 'quiz-gen';
            } },
        ...{ class: "tool-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-icon blue" },
    });
    const __VLS_12 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({
        icon: "mdi:creation",
        width: "48",
    }));
    const __VLS_14 = __VLS_13({
        icon: "mdi:creation",
        width: "48",
    }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-action" },
    });
    const __VLS_16 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_17 = __VLS_asFunctionalComponent(__VLS_16, new __VLS_16({
        icon: "mdi:arrow-right",
    }));
    const __VLS_18 = __VLS_17({
        icon: "mdi:arrow-right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_17));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.currentView === 'dashboard'))
                    return;
                __VLS_ctx.currentView = 'answer-sheet';
            } },
        ...{ class: "tool-card" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-icon green" },
    });
    const __VLS_20 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(__VLS_20, new __VLS_20({
        icon: "mdi:card-account-details-outline",
        width: "48",
    }));
    const __VLS_22 = __VLS_21({
        icon: "mdi:card-account-details-outline",
        width: "48",
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-content" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "card-action" },
    });
    const __VLS_24 = {}.Icon;
    /** @type {[typeof __VLS_components.Icon, ]} */ ;
    // @ts-ignore
    const __VLS_25 = __VLS_asFunctionalComponent(__VLS_24, new __VLS_24({
        icon: "mdi:arrow-right",
    }));
    const __VLS_26 = __VLS_25({
        icon: "mdi:arrow-right",
    }, ...__VLS_functionalComponentArgsRest(__VLS_25));
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "app-view fade-in" },
    });
    if (__VLS_ctx.currentView === 'quiz-gen') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "quiz-workspace" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "panel settings-panel" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "panel-header" },
        });
        const __VLS_28 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({
            icon: "mdi:tune-variant",
        }));
        const __VLS_30 = __VLS_29({
            icon: "mdi:tune-variant",
        }, ...__VLS_functionalComponentArgsRest(__VLS_29));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-stack" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.input)({
            ...{ class: "input" },
        });
        (__VLS_ctx.topic);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.label, __VLS_intrinsicElements.label)({});
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            ...{ class: "input" },
            value: (__VLS_ctx.knowledge),
            rows: "3",
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "form-group" },
        });
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
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.generate) },
            ...{ class: "primary-btn full" },
            disabled: (__VLS_ctx.loading),
        });
        const __VLS_32 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_33 = __VLS_asFunctionalComponent(__VLS_32, new __VLS_32({
            icon: "mdi:sparkles",
        }));
        const __VLS_34 = __VLS_33({
            icon: "mdi:sparkles",
        }, ...__VLS_functionalComponentArgsRest(__VLS_33));
        (__VLS_ctx.loading ? 'AI 生成中...' : '开始生成');
        if (__VLS_ctx.message) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "status-msg" },
            });
            (__VLS_ctx.message);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "panel preview-panel" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "panel-header" },
        });
        const __VLS_36 = {}.Icon;
        /** @type {[typeof __VLS_components.Icon, ]} */ ;
        // @ts-ignore
        const __VLS_37 = __VLS_asFunctionalComponent(__VLS_36, new __VLS_36({
            icon: "mdi:file-eye-outline",
        }));
        const __VLS_38 = __VLS_37({
            icon: "mdi:file-eye-outline",
        }, ...__VLS_functionalComponentArgsRest(__VLS_37));
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "preview-content" },
        });
        if (__VLS_ctx.result) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.pre, __VLS_intrinsicElements.pre)({});
            (JSON.stringify(__VLS_ctx.result, null, 2));
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
                ...{ class: "empty-placeholder" },
            });
            const __VLS_40 = {}.Icon;
            /** @type {[typeof __VLS_components.Icon, ]} */ ;
            // @ts-ignore
            const __VLS_41 = __VLS_asFunctionalComponent(__VLS_40, new __VLS_40({
                icon: "mdi:text-box-search-outline",
                width: "48",
            }));
            const __VLS_42 = __VLS_41({
                icon: "mdi:text-box-search-outline",
                width: "48",
            }, ...__VLS_functionalComponentArgsRest(__VLS_41));
            __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({});
        }
    }
    if (__VLS_ctx.currentView === 'answer-sheet') {
        /** @type {[typeof AnswerSheetDesigner, ]} */ ;
        // @ts-ignore
        const __VLS_44 = __VLS_asFunctionalComponent(AnswerSheetDesigner, new AnswerSheetDesigner({}));
        const __VLS_45 = __VLS_44({}, ...__VLS_functionalComponentArgsRest(__VLS_44));
    }
}
/** @type {__VLS_StyleScopedClasses['app-container']} */ ;
/** @type {__VLS_StyleScopedClasses['global-header']} */ ;
/** @type {__VLS_StyleScopedClasses['no-print']} */ ;
/** @type {__VLS_StyleScopedClasses['brand']} */ ;
/** @type {__VLS_StyleScopedClasses['logo-box']} */ ;
/** @type {__VLS_StyleScopedClasses['titles']} */ ;
/** @type {__VLS_StyleScopedClasses['main-title']} */ ;
/** @type {__VLS_StyleScopedClasses['sub-title']} */ ;
/** @type {__VLS_StyleScopedClasses['actions']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['outline']} */ ;
/** @type {__VLS_StyleScopedClasses['dashboard']} */ ;
/** @type {__VLS_StyleScopedClasses['fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['hero-section']} */ ;
/** @type {__VLS_StyleScopedClasses['cards-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['blue']} */ ;
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
/** @type {__VLS_StyleScopedClasses['card-action']} */ ;
/** @type {__VLS_StyleScopedClasses['tool-card']} */ ;
/** @type {__VLS_StyleScopedClasses['card-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['green']} */ ;
/** @type {__VLS_StyleScopedClasses['card-content']} */ ;
/** @type {__VLS_StyleScopedClasses['card-action']} */ ;
/** @type {__VLS_StyleScopedClasses['app-view']} */ ;
/** @type {__VLS_StyleScopedClasses['fade-in']} */ ;
/** @type {__VLS_StyleScopedClasses['quiz-workspace']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['form-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['form-group']} */ ;
/** @type {__VLS_StyleScopedClasses['input']} */ ;
/** @type {__VLS_StyleScopedClasses['primary-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['full']} */ ;
/** @type {__VLS_StyleScopedClasses['status-msg']} */ ;
/** @type {__VLS_StyleScopedClasses['panel']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['panel-header']} */ ;
/** @type {__VLS_StyleScopedClasses['preview-content']} */ ;
/** @type {__VLS_StyleScopedClasses['empty-placeholder']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            Icon: Icon,
            AnswerSheetDesigner: AnswerSheetDesigner,
            currentView: currentView,
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
