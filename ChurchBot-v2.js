// ==UserScript==
// @name         ChurchBot v2 - Igreja Automática
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Bot automático para construir igrejas com gerenciamento manual de buffs
// @include      https://*.the-west.*/game.php*
// @icon         https://westbr.innogamescdn.com/images/items/buildings/church.png
// @grant        none
// ==/UserScript==

(function() {
    const ChurchBot = {
        isRunning: false,
        currentState: "Parado",
        language: "pt_BR",
        allBuffs: [],
        selectedBuffs: {
            motivation: -1,
            energy: -1
        },
        settings: {
            churchTime: 3600,
            motivationThreshold: 90,
            energyThreshold: 80,
            paymentType: "town"
        },
        window: null,
        
        // Carregar idioma
        loadLanguage: function() {
            Ajax.remoteCall("settings", "settings", {}, function(resp) {
                ChurchBot.language = resp.lang.account.key;
            });
        },
        
        // Carregar buffs - BUSCA PELOS NOMES EXATOS
        loadBuffs: function() {
            ChurchBot.allBuffs = [];
            
            // Nomes dos buffs que procuramos
            const buffNames = [
                "Decoração de bolo",
                "Cigarro com filtro",
                "Tampa de metal para garrafa"
            ];
            
            // Procurar cada buff no inventário
            buffNames.forEach(buffName => {
                const items = Bag.search(buffName);
                items.forEach(item => {
                    if (item && item.obj) {
                        let type = "unknown";
                        
                        // Identificar tipo do buff
                        if (buffName === "Decoração de bolo") {
                            type = "motivation";
                        } else if (buffName === "Cigarro com filtro") {
                            type = "motivation";
                        } else if (buffName === "Tampa de metal para garrafa") {
                            type = "energy";
                        }
                        
                        ChurchBot.allBuffs.push({
                            id: item.obj.item_id,
                            name: item.obj.name,
                            type: type,
                            image: item.obj.image,
                            count: item.count,
                            usebonus: item.obj.usebonus
                        });
                    }
                });
            });
            
            console.log("Buffs carregados:", ChurchBot.allBuffs.length);
        },
        
        // Criar interface
        createUI: function() {
            const window = wman.open("ChurchBot").setResizeable(false).setMinSize(500, 450).setSize(500, 450).setMiniTitle("ChurchBot v2");
            const content = $('<div class="churchbot-window"/>');
            
            const tabs = {
                "settings": "Configurações",
                "buffs": "Buffs",
                "status": "Status"
            };
            
            const tabLogic = function(win, id) {
                ChurchBot.removeWindowContent();
                switch(id) {
                    case "settings":
                        content.html(ChurchBot.createSettingsTab());
                        break;
                    case "buffs":
                        ChurchBot.loadBuffs();
                        content.html(ChurchBot.createBuffsTab());
                        break;
                    case "status":
                        content.html(ChurchBot.createStatusTab());
                        break;
                }
                win.appendToContentPane(content);
            };
            
            for (let tab in tabs) {
                window.addTab(tabs[tab], tab, tabLogic);
            }
            
            ChurchBot.window = window;
            ChurchBot.selectTab("settings");
        },
        
        // Aba de Configurações
        createSettingsTab: function() {
            const html = $('<div style="padding: 20px;"/>');
            
            // Título
            html.append('<h2 style="color: #2E7D32; margin-top: 0;">⚙️ Configurações do Bot</h2>');
            
            // Tempo da Igreja
            const timeGroup = $('<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 15px;"/>');
            timeGroup.append('<label style="font-weight: bold; font-size: 14px; display: block; margin-bottom: 8px;">⏱️ Tempo de Construção da Igreja:</label>');
            const timeSelect = new west.gui.Combobox();
            timeSelect.addItem(900, "15 minutos");
            timeSelect.addItem(1800, "30 minutos");
            timeSelect.addItem(3600, "1 hora");
            timeSelect.select(ChurchBot.settings.churchTime);
            timeSelect.addListener(function(value) {
                ChurchBot.settings.churchTime = parseInt(value);
            });
            timeGroup.append(timeSelect.getMainDiv());
            html.append(timeGroup);
            
            // Motivação Threshold
            const motivationGroup = $('<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 15px;"/>');
            motivationGroup.append('<label style="font-weight: bold; font-size: 14px; display: block; margin-bottom: 8px;">💪 Usar buff de motivação quando cair para (%):</label>');
            const motivationInput = new west.gui.Textfield();
            motivationInput.setValue(ChurchBot.settings.motivationThreshold);
            motivationInput.setWidth(150);
            motivationInput.addListener(function(value) {
                let val = parseInt(value);
                if (!isNaN(val) && val > 0 && val <= 100) {
                    ChurchBot.settings.motivationThreshold = val;
                }
            });
            motivationGroup.append(motivationInput.getMainDiv());
            motivationGroup.append('<span style="margin-left: 10px; color: #666;">Padrão: 90%</span>');
            html.append(motivationGroup);
            
            // Energia Threshold
            const energyGroup = $('<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 15px;"/>');
            energyGroup.append('<label style="font-weight: bold; font-size: 14px; display: block; margin-bottom: 8px;">⚡ Usar buff de energia quando cair para (%):</label>');
            const energyInput = new west.gui.Textfield();
            energyInput.setValue(ChurchBot.settings.energyThreshold);
            energyInput.setWidth(150);
            energyInput.addListener(function(value) {
                let val = parseInt(value);
                if (!isNaN(val) && val > 0 && val <= 100) {
                    ChurchBot.settings.energyThreshold = val;
                }
            });
            energyGroup.append(energyInput.getMainDiv());
            energyGroup.append('<span style="margin-left: 10px; color: #666;">Padrão: 80%</span>');
            html.append(energyGroup);
            
            // Tipo de Pagamento
            const paymentGroup = $('<div style="margin-bottom: 20px;"/>');
            paymentGroup.append('<label style="font-weight: bold; font-size: 14px; display: block; margin-bottom: 8px;">💰 Pagamento:</label>');
            const paymentSelect = new west.gui.Combobox();
            paymentSelect.addItem("account", "Sua Conta");
            paymentSelect.addItem("town", "Cidade");
            paymentSelect.select(ChurchBot.settings.paymentType);
            paymentSelect.addListener(function(value) {
                ChurchBot.settings.paymentType = value;
            });
            paymentGroup.append(paymentSelect.getMainDiv());
            html.append(paymentGroup);
            
            // Botões
            const buttonGroup = $('<div style="margin-top: 30px; text-align: center;"/>');
            const startBtn = new west.gui.Button("▶️ Começar", function() {
                ChurchBot.start();
            });
            const stopBtn = new west.gui.Button("⏹️ Parar", function() {
                ChurchBot.stop();
            });
            
            buttonGroup.append(startBtn.getMainDiv());
            buttonGroup.append('<span style="margin: 0 10px;"></span>');
            buttonGroup.append(stopBtn.getMainDiv());
            html.append(buttonGroup);
            
            return html;
        },
        
        // Aba de Buffs
        createBuffsTab: function() {
            const html = $('<div style="padding: 20px;"/>');
            
            html.append('<h2 style="color: #2E7D32; margin-top: 0;">🧪 Selecione seus Buffs</h2>');
            
            if (ChurchBot.allBuffs.length === 0) {
                html.append('<p style="color: red; font-weight: bold;">❌ Nenhum buff encontrado no inventário!</p>');
                html.append('<p style="color: #666;">Buffs procurados:</p>');
                html.append('<ul style="color: #666;">');
                html.append('<li>Decoração de bolo</li>');
                html.append('<li>Cigarro com filtro</li>');
                html.append('<li>Tampa de metal para garrafa</li>');
                html.append('</ul>');
                return html;
            }
            
            const motivationBuffs = ChurchBot.allBuffs.filter(b => b.type === "motivation");
            const energyBuffs = ChurchBot.allBuffs.filter(b => b.type === "energy");
            
            if (motivationBuffs.length > 0) {
                html.append('<div style="margin-bottom: 20px; padding: 15px; background-color: #f0f8ff; border-left: 4px solid #2E7D32; border-radius: 4px;">');
                html.append('<strong style="color: #2E7D32; font-size: 14px;">💪 BUFFS DE MOTIVAÇÃO:</strong><br/><br/>');
                motivationBuffs.forEach((buff, index) => {
                    const checkbox = new west.gui.Checkbox();
                    checkbox.setLabel(buff.name + " (x" + buff.count + ")");
                    checkbox.setSelected(ChurchBot.selectedBuffs.motivation === index);
                    checkbox.setCallback(function() {
                        if (this.isSelected()) {
                            ChurchBot.selectedBuffs.motivation = index;
                            // Desselecionar outros
                            motivationBuffs.forEach((b, i) => {
                                if (i !== index) {
                                    $('input[type="checkbox"]').eq(i).prop('checked', false);
                                }
                            });
                        }
                    });
                    html.append(checkbox.getMainDiv());
                    html.append('<br/>');
                });
                html.append('</div>');
            } else {
                html.append('<p style="color: orange;">⚠️ Nenhum buff de motivação encontrado</p>');
            }
            
            if (energyBuffs.length > 0) {
                html.append('<div style="margin-bottom: 20px; padding: 15px; background-color: #fff8f0; border-left: 4px solid #1976D2; border-radius: 4px;">');
                html.append('<strong style="color: #1976D2; font-size: 14px;">⚡ BUFFS DE ENERGIA:</strong><br/><br/>');
                energyBuffs.forEach((buff, index) => {
                    const checkbox = new west.gui.Checkbox();
                    checkbox.setLabel(buff.name + " (x" + buff.count + ")");
                    checkbox.setSelected(ChurchBot.selectedBuffs.energy === index);
                    checkbox.setCallback(function() {
                        if (this.isSelected()) {
                            ChurchBot.selectedBuffs.energy = index;
                            // Desselecionar outros
                            energyBuffs.forEach((b, i) => {
                                if (i !== index) {
                                    $('input[type="checkbox"]').eq(motivationBuffs.length + i).prop('checked', false);
                                }
                            });
                        }
                    });
                    html.append(checkbox.getMainDiv());
                    html.append('<br/>');
                });
                html.append('</div>');
            } else {
                html.append('<p style="color: orange;">⚠️ Nenhum buff de energia encontrado</p>');
            }
            
            return html;
        },
        
        // Aba de Status
        createStatusTab: function() {
            const html = $('<div style="padding: 20px;"/>');
            html.append('<h2 style="color: #2E7D32; margin-top: 0;">📊 Status do Bot</h2>');
            
            const status = ChurchBot.isRunning ? '<span style="color: #2E7D32; font-weight: bold;">✅ RODANDO</span>' : '<span style="color: #d32f2f; font-weight: bold;">⏹️ PARADO</span>';
            html.append('<p><strong>Status:</strong> ' + status + '</p>');
            html.append('<p><strong>Estado:</strong> ' + ChurchBot.currentState + '</p>');
            html.append('<br/>');
            
            html.append('<div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">');
            html.append('<strong style="font-size: 14px;">📈 Personagem:</strong><br/>');
            html.append('<p>Motivação: <strong>' + Character.work_motivation + '%</strong></p>');
            html.append('<p>Energia: <strong>' + Math.round((Character.energy / Character.maxEnergy) * 100) + '%</strong></p>');
            html.append('<p>Dinheiro: <strong>' + Character.money.toLocaleString('pt-BR') + '</strong></p>');
            html.append('</div>');
            
            return html;
        },
        
        // Usar buff
        useBuff: async function(buffType) {
            ChurchBot.loadBuffs();
            
            let selectedIndex = -1;
            if (buffType === "motivation") {
                selectedIndex = ChurchBot.selectedBuffs.motivation;
            } else if (buffType === "energy") {
                selectedIndex = ChurchBot.selectedBuffs.energy;
            }
            
            if (selectedIndex === -1) {
                return false;
            }
            
            const buffs = ChurchBot.allBuffs.filter(b => b.type === buffType);
            
            if (selectedIndex < buffs.length && selectedIndex >= 0) {
                const buffToUse = buffs[selectedIndex];
                
                if (buffToUse.count <= 0) {
                    return false;
                }
                
                ItemUse.doIt(buffToUse.id);
                await new Promise(r => setTimeout(r, 2000));
                return true;
            }
            return false;
        },
        
        // Verificar e usar buffs
        checkAndUseBuffs: async function() {
            const motivation = Character.work_motivation;
            const energy = Math.round((Character.energy / Character.maxEnergy) * 100);
            
            if (motivation < ChurchBot.settings.motivationThreshold && ChurchBot.selectedBuffs.motivation !== -1) {
                const used = await ChurchBot.useBuff("motivation");
                if (used) {
                    new UserMessage("💪 Buff de motivação usado!", UserMessage.TYPE_HINT).show();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            
            if (energy < ChurchBot.settings.energyThreshold && ChurchBot.selectedBuffs.energy !== -1) {
                const used = await ChurchBot.useBuff("energy");
                if (used) {
                    new UserMessage("⚡ Buff de energia usado!", UserMessage.TYPE_HINT).show();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        },
        
        // Construir Igreja
        buildChurch: async function() {
            ChurchBot.currentState = "🏛️ Construindo Igreja...";
            ChurchBot.selectTab("status");
            
            const pos = Character.position;
            
            // Parâmetros da construção
            const taskData = {
                'x': pos.x,
                'y': pos.y,
                'building': 'church',
                'duration': ChurchBot.settings.churchTime
            };
            
            return new Promise((resolve) => {
                Ajax.remoteCall('task', 'add', taskData, function(data) {
                    if (data && !data.error) {
                        new UserMessage("✅ Igreja construindo!", UserMessage.TYPE_HINT).show();
                        resolve(true);
                    } else {
                        new UserMessage("❌ Erro ao construir Igreja!", UserMessage.TYPE_ERROR).show();
                        resolve(false);
                    }
                });
            });
        },
        
        // Iniciar bot
        start: async function() {
            if (ChurchBot.isRunning) {
                new UserMessage("Bot já está rodando!", UserMessage.TYPE_ERROR).show();
                return;
            }
            
            if (ChurchBot.selectedBuffs.motivation === -1 || ChurchBot.selectedBuffs.energy === -1) {
                new UserMessage("Selecione os buffs primeiro!", UserMessage.TYPE_ERROR).show();
                return;
            }
            
            ChurchBot.isRunning = true;
            ChurchBot.currentState = "🚀 Rodando";
            new UserMessage("✅ ChurchBot iniciado!", UserMessage.TYPE_HINT).show();
            
            while (ChurchBot.isRunning) {
                try {
                    await ChurchBot.checkAndUseBuffs();
                    const success = await ChurchBot.buildChurch();
                    
                    if (!success) {
                        ChurchBot.isRunning = false;
                        break;
                    }
                    
                    const waitTime = (ChurchBot.settings.churchTime * 1000) + 5000;
                    ChurchBot.currentState = "⏳ Aguardando próxima construção...";
                    await new Promise(r => setTimeout(r, waitTime));
                } catch (e) {
                    console.error("Erro no ChurchBot:", e);
                    ChurchBot.isRunning = false;
                    break;
                }
            }
        },
        
        // Parar bot
        stop: function() {
            ChurchBot.isRunning = false;
            ChurchBot.currentState = "⏹️ Parado";
            new UserMessage("❌ ChurchBot parado!", UserMessage.TYPE_HINT).show();
        },
        
        // Funções auxiliares
        selectTab: function(key) {
            if (ChurchBot.window && ChurchBot.window.tabIds && ChurchBot.window.tabIds[key]) {
                ChurchBot.window.tabIds[key].f(ChurchBot.window, key);
            }
        },
        
        removeWindowContent: function() {
            $(".churchbot-window").empty();
        },
        
        createMenuIcon: function() {
            const menuimage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADCc8QLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA5UlEQVR4nO3YwQqCQBiG4W9Jb0EXoUsQXaLbFN0i6BJ0CbpE3aJuURehi9RF6CJ1i7pFXaOgQEFREhQy+P8NDwMz38w3M38A/AAAAAAA/O+UUo7zPK/XdV3XdXEcRzRNI/P53HEcx3Ecx3Ecx3Ecx3Ecx/G/q9VqJZZlKQiCgiAoCAI5jkMYhmEYhmEYhmEYhmH8/1QqFQmCQJZlSSmlJEnSarWSJElSrVaTNE1Tr9eTJEnKsqw0TVM+n08JguDfqqpSp9NRvV5XrVbTaDRSrVZTvV5XvV5XrVar3W5XlmWpXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m001m02l02llWaamaVQURapWqwrDULPZTK1WS+PxWJPJRFmWqVAoKAgCVSoVZbNZpVIpFYvFfwPvAgAAAAAAAAAA/P/+AO0vFEKKTlZPAAAAAElFTkSuQmCC';
            const div = $('<div class="ui_menucontainer" />');
            const link = $('<div id="ChurchBotMenu" class="menulink" onclick="window.Game.ChurchBot.createUI();" title="ChurchBot - Igreja Automática" />').css('background-image', 'url(' + menuimage + ')')
              .css('background-position', '0px 0px')
              .mouseenter(function() {
                        $(this).css("background-position", "-25px 0px");
                    })
                    .mouseleave(function() {
                        $(this).css('background-position', '0px 0px');
                    });
            $('#ui_menubar').append((div).append(link).append('<div class="menucontainer_bottom" />'));
        }
    };

    $(document).ready(function() {
        try{
            ChurchBot.loadLanguage();
            window.Game.ChurchBot = ChurchBot;
            ChurchBot.createMenuIcon();
            new UserMessage("✅ ChurchBot v2 carregado! Clique no ícone de Igreja para abrir.", UserMessage.TYPE_HINT).show();
        }catch(e) {
            console.log("Erro ao carregar ChurchBot:", e);
        }
    });
})();
