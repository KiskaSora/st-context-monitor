import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, eventSource, event_types } from "../../../../script.js";

const extensionName = "st-context-monitor";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

let contextIndicator = null;
let lastPromptTokens = 0;
let messageStats = { hidden: 0, total: 0 };
let chatObserver = null;

const defaultSettings = {
    enabled: true,
    position: "top-right",
    opacity: 0.8,
    scale: 1.0,
    bgColor: "#000000",
    useCustomMax: false,
    customMax: 32000,
    showHiddenCounter: true,
    hiddenCounterPosition: "below"
};

async function loadSettings() {
    if (!extension_settings[extensionName]) {
        extension_settings[extensionName] = {};
    }
    
    for (const key in defaultSettings) {
        if (extension_settings[extensionName][key] === undefined) {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }
    
    const settings = extension_settings[extensionName];
    
    $("#context_monitor_enabled").prop("checked", settings.enabled);
    $("#context_monitor_position").val(settings.position);
    $("#context_monitor_opacity").val(settings.opacity);
    $("#context_monitor_scale").val(settings.scale);
    $("#context_monitor_bg_color").val(settings.bgColor);
    $("#context_monitor_use_custom_max").prop("checked", settings.useCustomMax);
    $("#context_monitor_custom_max").val(settings.customMax);
    $("#context_monitor_show_hidden").prop("checked", settings.showHiddenCounter);
    $("#context_monitor_hidden_position").val(settings.hiddenCounterPosition);
    
    $("#opacity_value").text(Math.round(settings.opacity * 100) + "%");
    $("#scale_value").text(settings.scale.toFixed(1) + "x");
    
    toggleCustomMaxField();
}

function toggleCustomMaxField() {
    const useCustom = extension_settings[extensionName].useCustomMax;
    if (useCustom) {
        $("#custom_max_container").show();
    } else {
        $("#custom_max_container").hide();
    }
}

function countMessages() {
    try {
        const context = getContext();
        const chat = context?.chat;
        
        if (!chat || chat.length === 0) {
            return { hidden: 0, total: 0 };
        }
        
        const totalMessages = chat.length;
        const hiddenMessages = chat.filter(msg => msg.is_system === true).length;
        
        return { 
            hidden: hiddenMessages,
            total: totalMessages
        };
    } catch (error) {
        console.error(`[${extensionName}] Error counting messages:`, error);
        return { hidden: 0, total: 0 };
    }
}

function startChatObserver() {
    if (chatObserver) {
        chatObserver.disconnect();
    }
    
    const chatBlock = document.getElementById('chat');
    if (!chatBlock) {
        console.log(`[${extensionName}] Chat block not found, will retry...`);
        return;
    }
    
    chatObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        for (const mutation of mutations) {
            if (mutation.type === 'childList' || 
                mutation.type === 'attributes' ||
                mutation.target.classList?.contains('mes')) {
                shouldUpdate = true;
                break;
            }
        }
        
        if (shouldUpdate) {
            const newStats = countMessages();
            if (newStats.hidden !== messageStats.hidden || newStats.total !== messageStats.total) {
                updateContextDisplay();
            }
        }
    });
    
    chatObserver.observe(chatBlock, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style']
    });
    
    console.log(`[${extensionName}] Chat observer started`);
}

function createIndicator() {
    if (contextIndicator) {
        contextIndicator.remove();
    }
    
    contextIndicator = $('<div id="context-monitor-indicator">0/0</div>');
    applyStyles();
    $('body').append(contextIndicator);
    
    updateContextDisplay();
}

function applyStyles() {
    if (!contextIndicator) return;
    
    const settings = extension_settings[extensionName];
    
    contextIndicator.removeClass('position-top-right position-top-left position-bottom-right position-bottom-left');
    contextIndicator.addClass(`position-${settings.position}`);
    
    contextIndicator.css({
        'opacity': settings.opacity,
        'transform': `scale(${settings.scale})`,
        'background-color': settings.bgColor,
        'transform-origin': settings.position.includes('bottom') 
            ? (settings.position.includes('right') ? 'bottom right' : 'bottom left')
            : (settings.position.includes('right') ? 'top right' : 'top left'),
        'white-space': settings.hiddenCounterPosition === 'below' ? 'pre-line' : 'nowrap'
    });
}

function updateContextDisplay() {
    if (!extension_settings[extensionName].enabled || !contextIndicator) return;
    
    const context = getContext();
    const settings = extension_settings[extensionName];
    
    if (context) {
        let usedTokens = lastPromptTokens;
        let maxTokens = 0;
        
        if (settings.useCustomMax) {
            maxTokens = settings.customMax || 32000;
        } else {
            maxTokens = context.maxContext || 0;
        }
        
        messageStats = countMessages();
        
        let displayHtml = `${usedTokens}/${maxTokens}`;
        
        if (settings.showHiddenCounter && messageStats.total > 0) {
            const ghostIcon = '<i class="fa-solid fa-ghost"></i>';
            
            if (settings.hiddenCounterPosition === 'inline') {
                displayHtml += ` | ${ghostIcon} ${messageStats.hidden}/${messageStats.total}`;
            } else if (settings.hiddenCounterPosition === 'below') {
                displayHtml += `<br>${ghostIcon} ${messageStats.hidden}/${messageStats.total}`;
            } else {
                displayHtml += ` (${ghostIcon} ${messageStats.hidden}/${messageStats.total})`;
            }
        }
        
        contextIndicator.html(displayHtml);
        
        const percentage = maxTokens > 0 ? (usedTokens / maxTokens) * 100 : 0;
        contextIndicator.removeClass('text-low text-medium text-high text-critical');
        
        if (percentage < 50) contextIndicator.addClass('text-low');
        else if (percentage < 75) contextIndicator.addClass('text-medium');
        else if (percentage < 90) contextIndicator.addClass('text-high');
        else contextIndicator.addClass('text-critical');
    }
}

function updateSetting(key, value) {
    extension_settings[extensionName][key] = value;
    saveSettingsDebounced();
    
    if (key === "useCustomMax") {
        toggleCustomMaxField();
        updateContextDisplay();
    } else if (key === "customMax" || key === "showHiddenCounter" || key === "hiddenCounterPosition") {
        updateContextDisplay();
    } else {
        applyStyles();
    }
}

function interceptPromptData() {
    const originalFetch = window.fetch;
    
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        const url = args[0];
        if (typeof url === 'string' && (url.includes('/generate') || url.includes('/chat/completions'))) {
            const clonedResponse = response.clone();
            
            try {
                const requestBody = args[1]?.body;
                if (requestBody) {
                    const data = JSON.parse(requestBody);
                    
                    if (data.messages && Array.isArray(data.messages)) {
                        let totalTokens = 0;
                        const context = getContext();
                        
                        if (context && typeof context.getTokenCount === 'function') {
                            const allText = data.messages.map(m => m.content || '').join('\n');
                            totalTokens = context.getTokenCount(allText);
                            
                            lastPromptTokens = totalTokens;
                            updateContextDisplay();
                        }
                    }
                }
            } catch (e) {
                console.error(`[${extensionName}] Error intercepting request:`, e);
            }
        }
        
        return response;
    };
    
    console.log(`[${extensionName}] Fetch interceptor installed`);
}

function tryReadFromChatCompletion() {
    const totalTokensElement = $('.prompt_total_tokens, [class*="total"], [class*="prompt"]').filter(function() {
        return $(this).text().includes('Всего токенов') || $(this).text().includes('Total tokens');
    });
    
    if (totalTokensElement.length > 0) {
        const text = totalTokensElement.text();
        const match = text.match(/(\d+)/);
        if (match) {
            const tokens = parseInt(match[1]);
            if (tokens > 0 && tokens !== lastPromptTokens) {
                lastPromptTokens = tokens;
                updateContextDisplay();
                return true;
            }
        }
    }
    
    return false;
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);
    
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);
        
        await loadSettings();
        interceptPromptData();
        
        $("#context_monitor_enabled").on("input", function() {
            const val = $(this).prop("checked");
            extension_settings[extensionName].enabled = val;
            saveSettingsDebounced();
            
            if (val) {
                createIndicator();
                startChatObserver();
            } else {
                if (contextIndicator) {
                    contextIndicator.remove();
                    contextIndicator = null;
                }
                if (chatObserver) {
                    chatObserver.disconnect();
                }
            }
        });
        
        $("#context_monitor_position").on("change", function() {
            updateSetting("position", $(this).val());
        });
        
        $("#context_monitor_opacity").on("input", function() {
            const val = parseFloat($(this).val());
            $("#opacity_value").text(Math.round(val * 100) + "%");
            updateSetting("opacity", val);
        });
        
        $("#context_monitor_scale").on("input", function() {
            const val = parseFloat($(this).val());
            $("#scale_value").text(val.toFixed(1) + "x");
            updateSetting("scale", val);
        });
        
        $("#context_monitor_bg_color").on("input", function() {
            updateSetting("bgColor", $(this).val());
        });

        $("#context_monitor_use_custom_max").on("input", function() {
            const val = $(this).prop("checked");
            updateSetting("useCustomMax", val);
        });

        $("#context_monitor_custom_max").on("input", function() {
            const val = parseInt($(this).val()) || 32000;
            updateSetting("customMax", val);
        });

        $("#context_monitor_show_hidden").on("input", function() {
            const val = $(this).prop("checked");
            updateSetting("showHiddenCounter", val);
        });

        $("#context_monitor_hidden_position").on("change", function() {
            updateSetting("hiddenCounterPosition", $(this).val());
        });

        if (extension_settings[extensionName].enabled) {
            createIndicator();
        }
        
        eventSource.on(event_types.MESSAGE_RECEIVED, updateContextDisplay);
        eventSource.on(event_types.MESSAGE_SENT, updateContextDisplay);
        eventSource.on(event_types.CHAT_CHANGED, () => {
            updateContextDisplay();
            startChatObserver();
        });
        eventSource.on(event_types.MESSAGE_DELETED, updateContextDisplay);
        eventSource.on(event_types.MESSAGE_EDITED, updateContextDisplay);
        eventSource.on(event_types.GENERATION_ENDED, () => {
            setTimeout(tryReadFromChatCompletion, 500);
        });
        
        setTimeout(() => {
            startChatObserver();
        }, 2000);
        
        setInterval(tryReadFromChatCompletion, 3000);
        setTimeout(updateContextDisplay, 1000);
        
        console.log(`[${extensionName}] Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] Failed to load:`, error);
    }
});
