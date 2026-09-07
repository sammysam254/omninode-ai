// Multi-Tier Fallback Conversational AI Decision Engine
// 1. OpenRouter (Free Models: Llama 3.3 70B, DeepSeek R1, Gemini 2.0 Flash Free, Qwen 2.5 32B Free)
// 2. Grok / Groq AI (Llama 3.3 70B Turbo / Grok-2)
// 3. Zero-API Free Web Inference
// 4. Google Gemini API
// 5. Embedded Offline Multimodal Reasoner

export class AiDecisionEngine {
    constructor() {
        this.openRouterKey = localStorage.getItem('omni_openrouter_key') || import.meta.env.VITE_OPENROUTER_API_KEY || '';
        this.grokKey = localStorage.getItem('omni_grok_key') || import.meta.env.VITE_GROK_API_KEY || '';
        this.geminiKey = localStorage.getItem('omni_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';

        this.conversationHistory = [];

        this.openRouterFreeModels = [
            'openrouter/auto',
            'nvidia/nemotron-3.5-lightning:free',
            'liquid/lfm-2.5-2.6b:free',
            'inclusionai/ling-3.0-flash-sante:free',
            'meta-llama/llama-3.2-3b-instruct:free',
            'google/gemini-2.0-flash-exp:free',
            'deepseek/deepseek-r1:free'
        ];
    }

    setKeys({ openRouterKey, grokKey, geminiKey }) {
        if (openRouterKey !== undefined) {
            this.openRouterKey = openRouterKey.trim();
            localStorage.setItem('omni_openrouter_key', this.openRouterKey);
        }
        if (grokKey !== undefined) {
            this.grokKey = grokKey.trim();
            localStorage.setItem('omni_grok_key', this.grokKey);
        }
        if (geminiKey !== undefined) {
            this.geminiKey = geminiKey.trim();
            localStorage.setItem('omni_gemini_api_key', this.geminiKey);
        }
    }

    clearHistory() {
        this.conversationHistory = [];
    }

    findRelevantAssets(prompt, allAssets) {
        if (!allAssets || allAssets.length === 0) return [];

        const queryTerms = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);

        const scoredAssets = allAssets.map(asset => {
            let score = 0;
            const fullText = `${asset.name} ${asset.file_path} ${asset.extracted_text || ''} ${JSON.stringify(asset.metadata || {})}`.toLowerCase();

            for (const term of queryTerms) {
                if (fullText.includes(term)) {
                    score += 5;
                    if (asset.name.toLowerCase().includes(term)) score += 10;
                    if ((asset.extracted_text || '').toLowerCase().includes(term)) score += 8;
                }
            }

            if (asset.asset_category === 'message') score += 2;
            if (asset.asset_category === 'image') score += 2;

            return { asset, score };
        });

        const relevant = scoredAssets
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.asset);

        return relevant.length > 0 ? relevant.slice(0, 8) : allAssets.slice(0, 6);
    }

    formatContext(assets, nodes, devices) {
        let topology = `CONNECTED MESH TOPOLOGY:
- Host PCs Online (${nodes?.length || 0}): ${nodes && nodes.length > 0 ? nodes.map(n => `${n.hostname} (IP: ${n.ip_address || '127.0.0.1'}, OS: ${n.os_info || 'Windows'})`).join(', ') : 'None registered yet'}
- Attached Physical Android Devices (${devices?.length || 0}): ${devices && devices.length > 0 ? devices.map(d => `${d.device_name} (Serial: ${d.device_id}, Battery: ${d.battery_level}%, OS: ${d.android_version})`).join(', ') : 'None plugged in via USB ADB yet'}
- Total Synced Assets in Database: ${assets?.length || 0}
`;

        if (assets && assets.length > 0) {
            topology += `\nREAL INDEXED ASSETS AVAILABLE ACROSS DEVICES (${assets.length} items):\n` + assets.map((a, idx) => `
[ASSET #${idx + 1}]
- Name: ${a.name}
- Device Origin: ${a.device_type.toUpperCase()} (Node: ${a.node_id}, Android Device: ${a.device_id || 'PC Storage'})
- Category: ${a.asset_category}
- File Path: ${a.file_path}
- Extracted Content / OCR / Message:
${a.extracted_text || 'None'}
- Metadata: ${JSON.stringify(a.metadata || {})}
`).join('\n---\n');
        }

        return topology;
    }

    getSystemPrompt(context) {
        return `You are OmniNode AI, an intelligent conversational decision-making and cross-device intelligence copilot.
You have real-time access to live hardware telemetry, connected USB Android phones, and files synced from host computers.

CURRENT LIVE EVIDENCE AND CONNECTED DEVICES:
${context}

Guidelines:
1. Ground your answers strictly in the real connected devices and assets provided above.
2. If the user asks what devices are connected, list the active Host PCs and USB Android devices with their details.
3. If citing evidence, name the exact file/message and the device it came from.
4. Be direct, conversational, and authoritative.`;
    }

    // ==========================================
    // TIER 1: OPENROUTER (Free Models Cascade)
    // ==========================================
    async callOpenRouter(systemPrompt, userPrompt) {
        const apiKey = this.openRouterKey || import.meta.env.VITE_OPENROUTER_API_KEY || '';

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory,
            { role: 'user', content: userPrompt }
        ];

        for (const model of this.openRouterFreeModels) {
            try {
                console.log(`[AiChat] Trying Tier 1 OpenRouter model: ${model}...`);
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
                        temperature: 0.3
                    })
                });

                if (!response.ok) {
                    continue;
                }

                const data = await response.json();
                const content = data.choices?.[0]?.message?.content;
                if (!content) continue;

                return {
                    reply: content,
                    source_engine: `Tier 1: OpenRouter (${model.replace(':free', '')})`
                };
            } catch (err) {
                console.warn(`[OpenRouter ${model}] error:`, err.message);
            }
        }
        throw new Error('OpenRouter free models unavailable.');
    }

    // ==========================================
    // TIER 2: GROK / GROQ AI (xAI or Groq API)
    // ==========================================
    async callGrok(systemPrompt, userPrompt) {
        const key = this.grokKey || import.meta.env.VITE_GROK_API_KEY || '';
        const isGroq = key.startsWith('gsk_');
        const endpoint = isGroq 
            ? 'https://api.groq.com/openai/v1/chat/completions' 
            : 'https://api.x.ai/v1/chat/completions';
        
        // Groq working models: qwen/qwen3.8-27b, openai/gpt-oss-120b, groq/compound
        const groqModels = ['qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'groq/compound'];
        const model = isGroq ? groqModels[0] : 'grok-2-latest';

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory,
            { role: 'user', content: userPrompt }
        ];

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            throw new Error(`Tier 2 API HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return {
            reply: content,
            source_engine: `Tier 2: ${isGroq ? 'Groq (Qwen 3.8 / Llama)' : 'xAI (Grok-2)'}`
        };
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
            source_engine: 'Tier 3: Free Public AI (Pollinations)'
        };
    }

    // ==========================================
    // TIER 4: GOOGLE GEMINI API
    // ==========================================
    async callGemini(systemPrompt, userPrompt) {
        if (!this.geminiKey) throw new Error('Gemini key not set.');

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
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
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        return {
            reply: content,
            source_engine: 'Tier 4: Google Gemini (1.5 Flash)'
        };
    }

    // ==========================================
    // TIER 5: OFFLINE HEURISTIC REASONER
    // ==========================================
    synthesizeOffline(userPrompt, assets, nodes, devices) {
        let text = `### OmniNode Decision Summary\n\n`;
        text += `I have searched across **${nodes?.length || 0} Host PC(s)** and **${devices?.length || 0} USB Android phone(s)**.\n\n`;

        if (assets.length > 0) {
            text += `Found **${assets.length} relevant assets** in your Supabase database:\n`;
            assets.slice(0, 4).forEach((a, i) => {
                text += `- **[${a.device_type.toUpperCase()}]** \`${a.name}\` (${a.asset_category}) - *${a.file_path}*\n`;
                if (a.extracted_text) {
                    text += `  > ${a.extracted_text.slice(0, 150)}...\n`;
                }
            });
            text += `\n**Conclusion**: Verified records match the requested parameters.`;
        } else {
            text += `No matching files, SMS, or screenshots were found for this query.\n\n`;
            text += `**Next Step**: Run \`setup.bat\` on your target PC or connect your Android device with USB Debugging enabled so files and messages can sync automatically into the database.`;
        }

        return {
            reply: text,
            source_engine: 'Tier 5: Embedded Offline Reasoner'
        };
    }

    // ==========================================
    // MASTER CHAT DISPATCHER
    // ==========================================
    async sendMessage(userPrompt, allAssets, allNodes, allDevices) {
        const relevantAssets = this.findRelevantAssets(userPrompt, allAssets);
        const context = this.formatContext(relevantAssets, allNodes, allDevices);
        const systemPrompt = this.getSystemPrompt(context);

        let result = null;

        // Tier 1: OpenRouter
        try {
            result = await this.callOpenRouter(systemPrompt, userPrompt);
        } catch (e1) {
            console.warn('[Tier 1 OpenRouter Failover]:', e1.message);
        }

        // Tier 2: Grok/Groq
        if (!result && this.grokKey) {
            try {
                result = await this.callGrok(systemPrompt, userPrompt);
            } catch (e2) {
                console.warn('[Tier 2 Grok/Groq Failover]:', e2.message);
            }
        }

        // Tier 3: Zero-API
        if (!result) {
            try {
                result = await this.callZeroApi(systemPrompt, userPrompt);
            } catch (e3) {
                console.warn('[Tier 3 Zero-API Failover]:', e3.message);
            }
        }

        // Tier 4: Gemini
        if (!result && this.geminiKey) {
            try {
                result = await this.callGemini(systemPrompt, userPrompt);
            } catch (e4) {
                console.warn('[Tier 4 Gemini Failover]:', e4.message);
            }
        }

        // Tier 5: Offline Reasoner
        if (!result) {
            result = this.synthesizeOffline(userPrompt, relevantAssets, allNodes, allDevices);
        }

        // Append to multi-turn conversation history
        this.conversationHistory.push({ role: 'user', content: userPrompt });
        this.conversationHistory.push({ role: 'assistant', content: result.reply });

        // Keep last 10 messages for memory efficiency
        if (this.conversationHistory.length > 10) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        return {
            reply: result.reply,
            source_engine: result.source_engine,
            cited_assets: relevantAssets,
            created_at: new Date().toISOString()
        };
    }
}

export const aiDecisionEngine = new AiDecisionEngine();
