// ==UserScript==
// @name         ChurchBot v2 - Igreja Automática
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Bot automático para construir igrejas com gerenciamento opcional de buffs
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
        selectedBuffs: [],
        settings: {
            churchTime: 3600,
            motivationThreshold: 90,
            energyThreshold: 80,
            paymentType: "town",
            useBuffs: false
        },
        window: null,
        cnbzTablePosition: {content: "0px", scrollbar: "0px"},
        
        // Carregar idioma
        loadLanguage: function() {
            Ajax.remoteCall("settings", "settings", {}, function(resp) {
                ChurchBot.language = resp.lang.account.key;
            });
        },
        
        // Carregar buffs - IGUAL AO BOT.TXT
        loadBuffs: function() {
            const searchKeys = {
                "pt_BR": {
                    "energy": "Aumento de energia",
                    "energyText": "Aumento de energia",
                    "motivation": "Aumento da motivação de trabalho",
                    "motivationText": "Aumento da motivação de trabalho",
                    "health": "Bônus de saúde",
                    "healthText": "Bônus de saúde"
                }
            };
            
            if (ChurchBot.language === "" || !searchKeys[ChurchBot.language]) {
                ChurchBot.language = "pt_BR";
            }
            
            const keys = searchKeys[ChurchBot.language];
            ChurchBot.allBuffs = [];
            
            // Procurar buffs de energia
            const energyItems = Bag.search(keys.energy);
            energyItems.forEach(item => {
                if (item && item.obj) {
                    ChurchBot.allBuffs.push({
                        id: item.obj.item_id,
                        name: item.obj.name,
                        type: "energy",
                        image: item.obj.image,
                        count: item.count,
                        selected: false,
                        usebonus: item.obj.usebonus
                    });
                }
            });
            
            // Procurar buffs de motivação
            const motivationItems = Bag.search(keys.motivation);
            motivationItems.forEach(item => {
                if (item && item.obj) {
                    ChurchBot.allBuffs.push({
                        id: item.obj.item_id,
                        name: item.obj.name,
                        type: "motivation",
                        image: item.obj.image,
                        count: item.count,
                        selected: false,
                        usebonus: item.obj.usebonus
                    });
                }
            });
            
            console.log("Buffs carregados:", ChurchBot.allBuffs.length);
        },
        
        // Criar interface
        createUI: function() {
            const window = wman.open("ChurchBot").setResizeable(false).setMinSize(550, 500).setSize(550, 500).setMiniTitle("ChurchBot v2");
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
                        ChurchBot.addBuffsTableCss();
                        $(".churchbot-window .tw2gui_scrollpane_clipper_contentpane").css({"top": ChurchBot.cnbzTablePosition.content});
                        $(".churchbot-window .tw2gui_scrollbar_pulley").css({"top": ChurchBot.cnbzTablePosition.scrollbar});
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
            
            // Usar Buffs?
            const useBuffsGroup = $('<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 15px;"/>');
            const useBuffsCheckbox = new west.gui.Checkbox();
            useBuffsCheckbox.setLabel("Usar Buffs (Opcional)");
            useBuffsCheckbox.setSelected(ChurchBot.settings.useBuffs);
            useBuffsCheckbox.setCallback(function() {
                ChurchBot.settings.useBuffs = this.isSelected();
            });
            useBuffsGroup.append(useBuffsCheckbox.getMainDiv());
            html.append(useBuffsGroup);
            
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
        
        // Aba de Buffs - TABELA COMO BOT.TXT
        createBuffsTab: function() {
            const html = $('<div style="padding: 15px;"/>');
            
            html.append('<h2 style="color: #2E7D32; margin-top: 0;">🧪 Selecione seus Buffs (Opcional)</h2>');
            
            ChurchBot.loadBuffs();
            
            if (ChurchBot.allBuffs.length === 0) {
                html.append('<p style="color: orange; font-weight: bold;">⚠️ Nenhum buff encontrado no inventário</p>');
                html.append('<p style="color: #666; font-size: 12px;">Você pode usar o bot sem buffs normalmente!</p>');
                return html;
            }
            
            const table = new west.gui.Table();
            table.addColumn("consumIcon","consumIcon")
                .addColumn("consumName","consumName")
                .addColumn("consumCount","consumCount")
                .addColumn("consumType","consumType")
                .addColumn("consumSelected","consumSelected");
            
            table.appendToCell("head","consumIcon","Ícone")
                .appendToCell("head","consumName","Nome")
                .appendToCell("head","consumCount","Quantidade")
                .appendToCell("head","consumType","Tipo")
                .appendToCell("head","consumSelected","Usar");
            
            ChurchBot.allBuffs.forEach((buff, index) => {
                const checkbox = new west.gui.Checkbox();
                checkbox.setSelected(buff.selected);
                checkbox.setCallback(function() {
                    ChurchBot.allBuffs[index].selected = this.isSelected();
                    // Atualizar selectedBuffs
                    ChurchBot.selectedBuffs = ChurchBot.allBuffs.filter(b => b.selected);
                    ChurchBot.cnbzTablePosition.content = $(".churchbot-window .tw2gui_scrollpane_clipper_contentpane").css("top");
                    ChurchBot.cnbzTablePosition.scrollbar = $(".churchbot-window .tw2gui_scrollbar_pulley").css("top");
                    ChurchBot.selectTab("buffs");
                });
                
                const type = buff.type === "energy" ? "⚡ Energia" : "💪 Motivação";
                const imgHtml = '<img src="' + buff.image + '" style="max-width: 50px; max-height: 50px;"/>';
                
                table.appendRow()
                    .appendToCell(-1, "consumIcon", imgHtml)
                    .appendToCell(-1, "consumName", buff.name)
                    .appendToCell(-1, "consumCount", buff.count)
                    .appendToCell(-1, "consumType", type)
                    .appendToCell(-1, "consumSelected", checkbox.getMainDiv());
            });
            
            // Botões de seleção rápida
            const buttonGroup = $('<div style="margin-top: 15px; text-align: center;"/>');
            const selectAllBtn = new west.gui.Button("✅ Selecionar Todos", function() {
                ChurchBot.allBuffs.forEach(b => b.selected = true);
                ChurchBot.selectedBuffs = ChurchBot.allBuffs;
                ChurchBot.selectTab("buffs");
            });
            const deselectAllBtn = new west.gui.Button("❌ Desmarcar Todos", function() {
                ChurchBot.allBuffs.forEach(b => b.selected = false);
                ChurchBot.selectedBuffs = [];
                ChurchBot.selectTab("buffs");
            });
            buttonGroup.append(selectAllBtn.getMainDiv());
            buttonGroup.append('<span style="margin: 0 5px;"></span>');
            buttonGroup.append(deselectAllBtn.getMainDiv());
            
            html.append(table.getMainDiv());
            html.append(buttonGroup);
            
            return html;
        },
        
        // CSS para tabela de buffs
        addBuffsTableCss: function() {
            $(".churchbot-window .consumIcon").css({"width": "60px"});
            $(".churchbot-window .consumName").css({"width": "180px"});
            $(".churchbot-window .consumCount").css({"width": "80px"});
            $(".churchbot-window .consumType").css({"width": "100px"});
            $(".churchbot-window .consumSelected").css({"width": "80px"});
            $(".churchbot-window .row").css({"height": "60px"});
            $('.churchbot-window').find('.tw2gui_scrollpane').css('height', '280px');
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
            
            html.append('<div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin-top: 15px;">');
            html.append('<strong style="font-size: 14px;">🧪 Buffs Selecionados:</strong><br/>');
            if (ChurchBot.selectedBuffs.length === 0) {
                html.append('<p style="color: #666;">Nenhum buff selecionado (bot rodará sem buffs)</p>');
            } else {
                html.append('<p>Total: ' + ChurchBot.selectedBuffs.length + ' buff(s)</p>');
                ChurchBot.selectedBuffs.forEach(buff => {
                    html.append('<p>• ' + buff.name + ' (x' + buff.count + ')</p>');
                });
            }
            html.append('</div>');
            
            return html;
        },
        
        // Usar buff
        useBuff: async function(buffType) {
            const buffsDisponibles = ChurchBot.selectedBuffs.filter(b => b.type === buffType);
            
            if (buffsDisponibles.length === 0) {
                return false;
            }
            
            const buffToUse = buffsDisponibles[0];
            
            if (buffToUse.count <= 0) {
                return false;
            }
            
            ItemUse.doIt(buffToUse.id);
            await new Promise(r => setTimeout(r, 2000));
            return true;
        },
        
        // Verificar e usar buffs
        checkAndUseBuffs: async function() {
            if (!ChurchBot.settings.useBuffs) {
                return;
            }
            
            const motivation = Character.work_motivation;
            const energy = Math.round((Character.energy / Character.maxEnergy) * 100);
            
            const motivationBuffs = ChurchBot.selectedBuffs.filter(b => b.type === "motivation");
            const energyBuffs = ChurchBot.selectedBuffs.filter(b => b.type === "energy");
            
            if (motivation < ChurchBot.settings.motivationThreshold && motivationBuffs.length > 0) {
                const used = await ChurchBot.useBuff("motivation");
                if (used) {
                    new UserMessage("💪 Buff de motivação usado!", UserMessage.TYPE_HINT).show();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            
            if (energy < ChurchBot.settings.energyThreshold && energyBuffs.length > 0) {
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
            const menuimage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAADCc8QLAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA5UlEQVR4nO3YwQqCQBiG4W9Jb0EXoUsQXaLbFN0i6BJ0CbpE3aJuURehi9RF6CJ1i7pFXaOgQEFREhQy+P8NDwMz38w3M38A/AAAAAAA/O+UUo7zPK/XdV3XdXEcRzRNI/P53HEcx3Ecx3Ecx3Ecx3Ecx/G/q9VqJZZlKQiCgiAoCAI5jkMYhmEYhmEYhmEYhmH8/1QqFQmCQJZlSSmlJEnSarWSJElSrVaTNE1Tr9eTJEnKsqw0TVM+n08JguDfqqpSp9NRvV5XrVbTaDRSrVar3W5XlmWpXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3MVBIHyPE+dTkfD4VDNZlONRkOtVkvD4VA1m021Wim12axarVZSmqapXq8rz3M=';
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
