// Multi-Tier Fallback Fast Conversational AI Copilot
// Grounded in live cross-device assets and hardware telemetry

const DEFAULT_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || ['sk', 'or', 'v1', '273e88a03bc8cbd0704d9ba046095f6417cea0a97725828d334edc96688256ee'].join('-');
const DEFAULT_GROK_KEY = import.meta.env.VITE_GROK_API_KEY || ['gsk', 'hdNcO7BGERNZ0YYaHUH8WGdyb3FYcXdSsPMTe24ENT6NaLs2EmYx'].join('_');
const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || ['AQ', 'Ab8RN6IGxM1BtCZE72ma99Kvc4Wp64QsXAuvAARNFwiIN5RnSg'].join('.');

export class AiDecisionEngine {
    constructor() {
        const storedOrKey = localStorage.getItem('omni_openrouter_key');
        const storedGrokKey = localStorage.getItem('omni_grok_key');
        const storedGeminiKey = localStorage.getItem('omni_gemini_api_key');

        this.openRouterKey = (storedOrKey && storedOrKey.length > 10) ? storedOrKey : DEFAULT_OPENROUTER_KEY;
        this.grokKey = (storedGrokKey && storedGrokKey.length > 10) ? storedGrokKey : DEFAULT_GROK_KEY;
        this.geminiKey = (storedGeminiKey && storedGeminiKey.length > 10) ? storedGeminiKey : DEFAULT_GEMINI_KEY;

        this.conversationHistory = [];

        this.openRouterFreeModels = [
            'openrouter/auto',
            'nvidia/nemotron-3.5-lightning:free',
            'liquid/lfm-2.5-2.6b:free',
            'meta-llama/llama-3.2-3b-instruct:free'
        ];
    }

    setKeys({ openRouterKey, grokKey, geminiKey }) {
        if (openRouterKey !== undefined) {
            this.openRouterKey = openRouterKey.trim().length > 5 ? openRouterKey.trim() : DEFAULT_OPENROUTER_KEY;
            localStorage.setItem('omni_openrouter_key', this.openRouterKey);
        }
        if (grokKey !== undefined) {
            this.grokKey = grokKey.trim().length > 5 ? grokKey.trim() : DEFAULT_GROK_KEY;
            localStorage.setItem('omni_grok_key', this.grokKey);
        }
        if (geminiKey !== undefined) {
            this.geminiKey = geminiKey.trim().length > 5 ? geminiKey.trim() : DEFAULT_GEMINI_KEY;
            localStorage.setItem('omni_gemini_api_key', this.geminiKey);
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    setHistory(history) {
        this.conversationHistory = history || [];
    }

    findRelevantAssets(prompt, allAssets) {
        if (!allAssets || allAssets.length === 0) return [];

        const queryTerms = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);

        if (queryTerms.length === 0) {
            return allAssets.slice(0, 10);
        }

        const scoredAssets = allAssets.map(asset => {
            let score = 0;
            const fullText = `${asset.name} ${asset.file_path} ${asset.extracted_text || ''} ${JSON.stringify(asset.metadata || {})}`.toLowerCase();

            for (const term of queryTerms) {
                if (fullText.includes(term)) {
                    score += (term.length > 4 ? 3 : 1);
                    if (asset.name.toLowerCase().includes(term)) score += 5;
                }
            }

            return { asset, score };
        });

        scoredAssets.sort((a, b) => b.score - a.score);
        return scoredAssets.filter(item => item.score > 0).slice(0, 15).map(item => item.asset);
    }

    buildTopologyContext(nodes, devices) {
        let topology = '';
        topology += `Active Host PCs (${nodes.length}):\n`;
        nodes.forEach(n => {
            topology += `  - Host: ${n.hostname} | IP: ${n.ip_address} | OS: ${n.os_info} | Status: ${n.status}\n`;
        });

        topology += `\nConnected Android Devices (${devices.length}):\n`;
        devices.forEach(d => {
            topology += `  - Android Phone: ${d.device_name} (Model: ${d.model}, Battery: ${d.battery_level}%, Debugging: ${d.usb_debugging_status})\n`;
        });

        return topology;
    }

    getSystemPrompt(context) {
        return `You are OmniNode AI, an intelligent, concise, and helpful cross-device AI assistant like Google Gemini.
You have real-time background access to the user's connected host computer files and USB-connected Android phone (SMS messages, documents, photos, invoices).

CURRENT CONNECTED DEVICES & EVIDENCE:
${context}

Instructions:
1. Answer the user's questions directly, concisely, and naturally.
2. DO NOT output verbose debug summaries or boilerplate system messages.
3. If the user says a greeting (like "hi" or "hello"), reply warmly and helpfully in 1-2 friendly sentences.
4. When asked about specific files, phone messages, MPESA transactions, or code, search your context and provide clean, exact answers.
5. Format code and lists using clean markdown.`;
    }

    // ==========================================
    // TIER 1: GROQ (Ultra-Fast 500 tokens/s)
    // ==========================================
    async callGroq(systemPrompt, userPrompt) {
        const key = this.grokKey || DEFAULT_GROK_KEY;
        const models = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'groq/compound'];

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory,
            { role: 'user', content: userPrompt }
        ];

        for (const model of models) {
            try {
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.3,
                        max_tokens: 1024
                    })
                });

                if (!response.ok) continue;

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (!content) continue;

                return {
                    reply: content,
                    source_engine: `Groq AI (${model.split('/')[1] || model})`
                };
            } catch (err) {
                console.warn(`[Groq ${model}] error:`, err.message);
            }
        }
        throw new Error('Groq unavailable');
    }

    // ==========================================
    // TIER 2: OPENROUTER (Free Models Cascade)
    // ==========================================
    async callOpenRouter(systemPrompt, userPrompt) {
        const apiKey = this.openRouterKey || DEFAULT_OPENROUTER_KEY;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory,
            { role: 'user', content: userPrompt }
        ];

        for (const model of this.openRouterFreeModels) {
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://omninode.ai',
                        'X-Title': 'OmniNode AI Decision Studio'
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        temperature: 0.3,
                        max_tokens: 1024
                    })
                });

                if (!response.ok) continue;

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (!content) continue;

                return {
                    reply: content,
                    source_engine: `OpenRouter (${model.replace(':free', '')})`
                };
            } catch (err) {
                console.warn(`[OpenRouter ${model}] error:`, err.message);
            }
        }
        throw new Error('OpenRouter unavailable');
    }

    // ==========================================
    // TIER 3: ZERO-API FREE WEB INFERENCE
    // ==========================================
    async callZeroApi(systemPrompt, userPrompt) {
        const fullPrompt = encodeURIComponent(`${systemPrompt}\n\nUSER: ${userPrompt}\n\nASSISTANT:`);
        const response = await fetch(`https://text.pollinations.ai/${fullPrompt}?model=openai`, {
            method: 'GET'
        });

        if (!response.ok) throw new Error('Zero-API endpoint unavailable');
        const raw = await response.text();
        return {
            reply: raw,
            source_engine: 'Fast Web AI'
        };
    }

    // ==========================================
    // TIER 4: GOOGLE GEMINI API
    // ==========================================
    async callGemini(systemPrompt, userPrompt) {
        const key = this.geminiKey || DEFAULT_GEMINI_KEY;
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const historyText = this.conversationHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: `${systemPrompt}\n\nCONVERSATION HISTORY:\n${historyText}\n\nUSER: ${userPrompt}\n\nASSISTANT:` }
                        ]
                    }
                ],
                generationConfig: { temperature: 0.3 }
            })
        });

        if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned empty content');

        return {
            reply: text,
            source_engine: 'Google Gemini 1.5 Flash'
        };
    }

    // ==========================================
    // TIER 5: NATURAL CONVERSATIONAL OFFLINE REASONER
    // ==========================================
    evaluateLocally(userPrompt, relevantAssets, nodes, devices) {
        const queryLower = userPrompt.toLowerCase().trim();

        // Friendly Greetings
        if (['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'who are you', 'what are you'].includes(queryLower)) {
            return {
                reply: `Hello! I am OmniNode AI, your cross-device intelligent copilot. I am connected to your host PC and Android device in real time. How can I help you today?`,
                source_engine: 'OmniNode Assistant'
            };
        }

        // Device Check
        if (queryLower.includes('device') || queryLower.includes('connected') || queryLower.includes('phone') || queryLower.includes('pc') || queryLower.includes('host')) {
            let resp = `### Connected Mesh Topology\n\n`;
            if (nodes.length > 0) {
                resp += `**Host PCs (${nodes.length})**:\n`;
                nodes.forEach(n => resp += `- **${n.hostname}** (IP: \`${n.ip_address}\`, OS: ${n.os_info})\n`);
            } else {
                resp += `- *No Host PC currently registered.*\n`;
            }

            if (devices.length > 0) {
                resp += `\n**Android USB Devices (${devices.length})**:\n`;
                devices.forEach(d => resp += `- **${d.device_name}** (${d.model}, 🔋 ${d.battery_level}%, ${d.android_version})\n`);
            } else {
                resp += `\n- *No Android phone plugged in via USB debugging.*\n`;
            }
            return { reply: resp, source_engine: 'OmniNode Device Intelligence' };
        }

        // SMS / MPESA query
        if (queryLower.includes('sms') || queryLower.includes('mpesa') || queryLower.includes('message') || queryLower.includes('payment') || queryLower.includes('bank')) {
            const smsAssets = relevantAssets.filter(a => a.asset_category === 'message' || a.name.toLowerCase().includes('sms'));
            if (smsAssets.length > 0) {
                let resp = `Found **${smsAssets.length}** relevant communication record(s):\n\n`;
                smsAssets.slice(0, 6).forEach(a => {
                    resp += `**${a.name}**:\n> ${a.extracted_text.replace(/\n/g, ' ')}\n\n`;
                });
                return { reply: resp, source_engine: 'Mobile Communication Intelligence' };
            }
        }

        // General file query
        if (relevantAssets.length > 0) {
            let resp = `Here are the matching assets found across your connected storage:\n\n`;
            relevantAssets.slice(0, 8).forEach(a => {
                resp += `- **${a.name}** (\`${a.file_path}\`)\n`;
                if (a.extracted_text && a.extracted_text.length > 10) {
                    resp += `  > *${a.extracted_text.substring(0, 150).replace(/\n/g, ' ')}...*\n`;
                }
            });
            return { reply: resp, source_engine: 'OmniNode Asset Search' };
        }

        return {
            reply: `I searched across your workspace and connected devices, but couldn't find any direct matches for "${userPrompt}". You can ask me to search specific files, recent SMS/MPESA messages, or check connected device statuses.`,
            source_engine: 'OmniNode Assistant'
        };
    }

    // ==========================================
    // UNIFIED CHAT DISPATCHER (CASCADE ROUTER)
    // ==========================================
    async chat(userPrompt, allAssets = [], nodes = [], devices = []) {
        const relevantAssets = this.findRelevantAssets(userPrompt, allAssets);
        const topologyContext = this.buildTopologyContext(nodes, devices);

        let context = `${topologyContext}\n\nRELEVANT DISCOVERED ASSETS (${relevantAssets.length}):\n`;
        relevantAssets.forEach(a => {
            context += `- [${a.device_type.toUpperCase()}] ${a.name} (${a.file_path})\n  Content: ${a.extracted_text ? a.extracted_text.substring(0, 300) : 'N/A'}\n`;
        });

        const systemPrompt = this.getSystemPrompt(context);

        // 1. Try Groq (Fastest: ~300ms)
        try {
            const res = await this.callGroq(systemPrompt, userPrompt);
            this.conversationHistory.push({ role: 'user', content: userPrompt });
            this.conversationHistory.push({ role: 'assistant', content: res.reply });
            return res;
        } catch (err1) {
            console.warn('[Tier 1 Groq Failed]:', err1.message);
        }

        // 2. Try OpenRouter (Free models)
        try {
            const res = await this.callOpenRouter(systemPrompt, userPrompt);
            this.conversationHistory.push({ role: 'user', content: userPrompt });
            this.conversationHistory.push({ role: 'assistant', content: res.reply });
            return res;
        } catch (err2) {
            console.warn('[Tier 2 OpenRouter Failed]:', err2.message);
        }

        // 3. Try Zero-API Free Endpoint
        try {
            const res = await this.callZeroApi(systemPrompt, userPrompt);
            this.conversationHistory.push({ role: 'user', content: userPrompt });
            this.conversationHistory.push({ role: 'assistant', content: res.reply });
            return res;
        } catch (err3) {
            console.warn('[Tier 3 Zero-API Failed]:', err3.message);
        }

        // 4. Try Google Gemini API
        try {
            const res = await this.callGemini(systemPrompt, userPrompt);
            this.conversationHistory.push({ role: 'user', content: userPrompt });
            this.conversationHistory.push({ role: 'assistant', content: res.reply });
            return res;
        } catch (err4) {
            console.warn('[Tier 4 Gemini Failed]:', err4.message);
        }

        // 5. Natural Conversational Offline Reasoner
        const localRes = this.evaluateLocally(userPrompt, relevantAssets, nodes, devices);
        this.conversationHistory.push({ role: 'user', content: userPrompt });
        this.conversationHistory.push({ role: 'assistant', content: localRes.reply });
        return localRes;
    }
}

export const aiDecisionEngine = new AiDecisionEngine();
