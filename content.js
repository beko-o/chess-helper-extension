(function() {
  // content.js для Chess Assistant extension

  // Флаг отладки: установите false, чтобы не спамить консоль.
  const debug = false;
  function dlog(...args) {
    if (debug) console.log(...args);
  }

  // === Панель настроек ===
  function createSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "chess-assistant-settings";
    panel.style.position = "fixed";
    panel.style.top = "10px";
    panel.style.right = "10px";
    panel.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    panel.style.color = "white";
    panel.style.padding = "10px";
    panel.style.borderRadius = "5px";
    panel.style.zIndex = "10000";
    panel.style.fontFamily = "Arial, sans-serif";
    panel.style.fontSize = "14px";
    
    // Выбор цвета
    const colorLabel = document.createElement("label");
    colorLabel.textContent = "Цвет: ";
    const whiteRadio = document.createElement("input");
    whiteRadio.type = "radio";
    whiteRadio.name = "assistantColor";
    whiteRadio.value = "w";
    const blackRadio = document.createElement("input");
    blackRadio.type = "radio";
    blackRadio.name = "assistantColor";
    blackRadio.value = "b";
    let savedColor = localStorage.getItem("chessAssistantColor") || "w";
    if (savedColor === "w") {
      whiteRadio.checked = true;
    } else {
      blackRadio.checked = true;
    }
    colorLabel.appendChild(whiteRadio);
    colorLabel.appendChild(document.createTextNode(" Белые "));
    colorLabel.appendChild(blackRadio);
    colorLabel.appendChild(document.createTextNode(" Черные"));
    
    // Выбор глубины поиска Stockfish
    const depthLabel = document.createElement("label");
    depthLabel.textContent = " Глубина: ";
    const depthInput = document.createElement("input");
    depthInput.type = "number";
    depthInput.min = "1";
    depthInput.max = "20";
    depthInput.style.width = "40px";
    let savedDepth = localStorage.getItem("chessAssistantDepth") || "15";
    depthInput.value = savedDepth;
    depthLabel.appendChild(depthInput);
    
    // Checkbox для показа стрелок
    const arrowLabel = document.createElement("label");
    arrowLabel.textContent = " Показывать стрелки: ";
    const arrowCheckbox = document.createElement("input");
    arrowCheckbox.type = "checkbox";
    let savedArrows = localStorage.getItem("chessAssistantShowArrows") || "false";
    arrowCheckbox.checked = (savedArrows === "true");
    arrowLabel.appendChild(arrowCheckbox);
    
    panel.appendChild(colorLabel);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(depthLabel);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(arrowLabel);
    
    document.body.appendChild(panel);
    
    // Обработчики изменения настроек
    whiteRadio.addEventListener("change", () => {
      if (whiteRadio.checked) {
        localStorage.setItem("chessAssistantColor", "w");
        myColor = "w";
      }
    });
    blackRadio.addEventListener("change", () => {
      if (blackRadio.checked) {
        localStorage.setItem("chessAssistantColor", "b");
        myColor = "b";
      }
    });
    depthInput.addEventListener("change", () => {
      let val = parseInt(depthInput.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 20) val = 20;
      depthInput.value = val;
      localStorage.setItem("chessAssistantDepth", val);
      assistantDepth = val;
    });
    arrowCheckbox.addEventListener("change", () => {
      localStorage.setItem("chessAssistantShowArrows", arrowCheckbox.checked);
      assistantShowArrows = arrowCheckbox.checked;
      if (!assistantShowArrows) clearArrows();
    });
  }
  
  // Создание полосы оценки (evaluation bar)
  function createEvaluationBar() {
    const evalBar = document.createElement("div");
    evalBar.id = "evaluation-bar";
    evalBar.style.position = "fixed";
    evalBar.style.bottom = "50px";
    evalBar.style.left = "50%";
    evalBar.style.transform = "translateX(-50%)";
    evalBar.style.backgroundColor = "#ddd";
    evalBar.style.border = "1px solid #333";
    evalBar.style.width = "300px";
    evalBar.style.height = "20px";
    evalBar.style.borderRadius = "5px";
    evalBar.style.overflow = "hidden";
    evalBar.style.zIndex = "10000";
    
    const innerBar = document.createElement("div");
    innerBar.id = "evaluation-bar-inner";
    innerBar.style.height = "100%";
    innerBar.style.width = "50%"; // нейтральное значение
    innerBar.style.backgroundColor = "gray";
    evalBar.appendChild(innerBar);
    
    const evalText = document.createElement("div");
    evalText.id = "evaluation-text";
    evalText.style.position = "absolute";
    evalText.style.top = "0";
    evalText.style.left = "50%";
    evalText.style.transform = "translateX(-50%)";
    evalText.style.width = "100%";
    evalText.style.textAlign = "center";
    evalText.style.fontSize = "12px";
    evalText.style.color = "#000";
    evalText.style.pointerEvents = "none";
    evalBar.appendChild(evalText);
    
    document.body.appendChild(evalBar);
  }
  
  // Глобальные переменные настроек
  let myColor = localStorage.getItem("chessAssistantColor") || "w";
  let assistantDepth = parseInt(localStorage.getItem("chessAssistantDepth"), 10) || 15;
  let assistantShowArrows = (localStorage.getItem("chessAssistantShowArrows") === "true");
  
  createSettingsPanel();
  createEvaluationBar();
  // === Конец панели настроек и полосы оценки ===

  // Глобальные переменные для отслеживания позиции (резервный метод)
  let lastBoardHash = "";
  let currentTurn = "w";
  
  // Для оценки качества хода сохраняем последний рекомендованный ход
  let lastBestMove = "";
  // И определяем цвета для разных категорий
  const qualityColors = {
    brilliant: "#40e0d0",  // бирюзовый
    great: "#add8e6",      // светло-синий
    best: "#90ee90",       // светло-зеленый
    mistake: "orange",
    miss: "#ff4500",       // красно-оранжевый
    blunder: "red"
  };

  // Функция загрузки Stockfish
  function createStockfishWorker() {
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open("GET", chrome.runtime.getURL("stockfish.js"), true);
      xhr.responseType = "text";
      xhr.onload = function () {
        if (xhr.status === 200) {
          const blob = new Blob([xhr.response], { type: "application/javascript" });
          const workerURL = URL.createObjectURL(blob);
          const stockfish = new Worker(workerURL);
          resolve(stockfish);
        } else {
          reject(new Error(`Ошибка загрузки Stockfish: ${xhr.statusText}`));
        }
      };
      xhr.onerror = function () {
        reject(new Error("❌ Ошибка сети при загрузке Stockfish.js"));
      };
      xhr.send();
    });
  }

  createStockfishWorker().then(stockfish => {
    dlog("Stockfish загружен");

    stockfish.postMessage("uci");
    stockfish.postMessage("isready");

    stockfish.onmessage = function (event) {
      if (event.data.startsWith("info") && event.data.indexOf("score") !== -1) {
        let scoreInfo = parseScore(event.data);
        if (scoreInfo && scoreInfo.type) {
          updateEvaluationBar(scoreInfo);
        }
      }
      if (event.data.startsWith("bestmove")) {
        let bestMove = event.data.split(" ")[1];
        if (bestMove !== "(none)") {
          lastBestMove = bestMove;
          dlog("Лучший ход:", bestMove);
          showBestMove(bestMove);
        }
      }
    };

    // Анализ позиции с заданной глубиной
    function analyzePosition(fen) {
      dlog("Отправляем FEN в Stockfish:", fen);
      stockfish.postMessage("position fen " + fen);
      stockfish.postMessage("go depth " + assistantDepth);
    }

    function clearSuggestion() {
      let moveDisplay = document.getElementById("best-move-display");
      if (moveDisplay) {
        moveDisplay.innerText = "";
      }
      clearArrows();
    }

    // Резервный метод: вычисление «хеша» позиции (FEN без информации о ходе)
    function computeBoardHash() {
      let pieces = document.querySelectorAll(".piece");
      return calculateFENFromPieces(pieces);
    }

    // Определение текущего хода по списку ходов (move list)
    function getCurrentTurnFromMoveList() {
      let moveListContainer = document.querySelector('.play-controller-moveList.move-list') ||
                              document.querySelector('wc-simple-move-list');
      if (moveListContainer) {
        let whiteMoves = moveListContainer.querySelectorAll('.node.white-move');
        let blackMoves = moveListContainer.querySelectorAll('.node.black-move');
        dlog("White moves:", whiteMoves.length, "Black moves:", blackMoves.length);
        return (whiteMoves.length === blackMoves.length) ? "w" : "b";
      }
      return null;
    }

    // Функция проверки доски, определения текущего хода и запуска анализа
    function checkBoard() {
      let board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
      if (!board) {
        dlog("Шахматная доска не найдена!");
        return;
      }
      let turnFromList = getCurrentTurnFromMoveList();
      if (turnFromList !== null) {
        currentTurn = turnFromList;
        dlog("Определение через список ходов: сейчас ход", currentTurn);
      } else {
        let boardHash = computeBoardHash();
        dlog("Вычисленный хеш позиции (резерв):", boardHash);
        if (lastBoardHash === "") {
          lastBoardHash = boardHash;
        } else if (boardHash !== lastBoardHash) {
          currentTurn = (currentTurn === "w") ? "b" : "w";
          dlog("Позиция изменилась (резерв). Теперь ход:", currentTurn);
          lastBoardHash = boardHash;
        } else {
          dlog("Позиция не изменилась (резерв).");
        }
      }
      // Если сейчас не ваш ход – значит последний ход завершён, оценим его качество
      if (currentTurn !== myColor) {
        dlog("Сейчас ход", currentTurn, "(не мой, мой цвет:", myColor, "). Оценка сыгранного хода.");
        evaluateLastMoveQuality();
        clearSuggestion();
        return;
      }
      let fen = computeBoardHash() + " " + currentTurn + " - - 0 1";
      dlog("Мой ход. FEN:", fen);
      analyzePosition(fen);
    }

    // Функция отображения рекомендованного хода (текст и, если включено, стрелка)
    function showBestMove(move) {
      let moveDisplay = document.getElementById("best-move-display");
      if (!moveDisplay) {
        moveDisplay = document.createElement("div");
        moveDisplay.id = "best-move-display";
        moveDisplay.style.position = "fixed";
        moveDisplay.style.bottom = "10px";
        moveDisplay.style.right = "10px";
        moveDisplay.style.backgroundColor = "black";
        moveDisplay.style.color = "white";
        moveDisplay.style.padding = "10px";
        moveDisplay.style.borderRadius = "5px";
        document.body.appendChild(moveDisplay);
      }
      moveDisplay.innerText = "Рекомендованный ход: " + move;
      if (assistantShowArrows && move.length >= 4) {
        let fromSquare = move.substring(0, 2);
        let toSquare = move.substring(2, 4);
        drawArrow(fromSquare, toSquare);
      }
    }

    // Функция парсинга оценки из сообщения Stockfish
    function parseScore(message) {
      let parts = message.split(" ");
      let idx = parts.indexOf("score");
      if (idx !== -1 && parts.length > idx + 2) {
        let scoreType = parts[idx + 1];
        let scoreValue = parseInt(parts[idx + 2], 10);
        if (scoreType === "cp") {
          return { type: "cp", value: scoreValue };
        } else if (scoreType === "mate") {
          return { type: "mate", value: scoreValue };
        }
      }
      return null;
    }

    // Функция обновления evaluation bar
    function updateEvaluationBar(scoreInfo) {
      const evalBar = document.getElementById("evaluation-bar");
      const innerBar = document.getElementById("evaluation-bar-inner");
      const evalText = document.getElementById("evaluation-text");
      if (!evalBar || !innerBar || !evalText) return;
      if (scoreInfo.type === "cp") {
        let cp = scoreInfo.value;
        let clamped = Math.max(-300, Math.min(300, cp));
        let percentage = 50 + (clamped / 600) * 100; // 0% - 100%, 50% нейтрально
        innerBar.style.width = percentage + "%";
        innerBar.style.backgroundColor = cp > 0 ? "green" : cp < 0 ? "red" : "gray";
        evalText.textContent = "Eval: " + cp + " cp";
      } else if (scoreInfo.type === "mate") {
        innerBar.style.width = scoreInfo.value > 0 ? "100%" : "0%";
        innerBar.style.backgroundColor = scoreInfo.value > 0 ? "green" : "red";
        evalText.textContent = "Mate in " + Math.abs(scoreInfo.value);
      }
    }

    // === Функции отрисовки стрелок на доске ===

    function getSquareCenter(square, boardRect) {
      const squareSize = boardRect.width / 8;
      let file = square[0];
      let rank = parseInt(square[1], 10);
      let fileIndex = file.charCodeAt(0) - "a".charCodeAt(0);
      let rankIndex;
      if (myColor === "w") {
        rankIndex = 8 - rank;
      } else {
        rankIndex = rank - 1;
        fileIndex = 7 - fileIndex;
      }
      return {
        x: fileIndex * squareSize + squareSize / 2,
        y: rankIndex * squareSize + squareSize / 2
      };
    }

    function getArrowOverlay(board) {
      let overlay = board.querySelector("#assistant-arrow-overlay");
      if (!overlay) {
        overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        overlay.setAttribute("id", "assistant-arrow-overlay");
        overlay.style.position = "absolute";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.pointerEvents = "none";
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "arrowhead");
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "7");
        marker.setAttribute("refX", "0");
        marker.setAttribute("refY", "3.5");
        marker.setAttribute("orient", "auto");
        const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        polygon.setAttribute("points", "0 0, 10 3.5, 0 7");
        polygon.setAttribute("fill", "red");
        marker.appendChild(polygon);
        defs.appendChild(marker);
        overlay.appendChild(defs);
        board.style.position = "relative";
        board.appendChild(overlay);
      }
      return overlay;
    }

    function drawArrow(fromSquare, toSquare) {
      let board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
      if (!board) return;
      let boardRect = board.getBoundingClientRect();
      let fromCenter = getSquareCenter(fromSquare, boardRect);
      let toCenter = getSquareCenter(toSquare, boardRect);
      let overlay = getArrowOverlay(board);
      while (overlay.lastChild && overlay.lastChild.nodeName === "line") {
        overlay.removeChild(overlay.lastChild);
      }
      let line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", fromCenter.x);
      line.setAttribute("y1", fromCenter.y);
      line.setAttribute("x2", toCenter.x);
      line.setAttribute("y2", toCenter.y);
      line.setAttribute("stroke", "red");
      line.setAttribute("stroke-width", "4");
      line.setAttribute("marker-end", "url(#arrowhead)");
      overlay.appendChild(line);
    }

    function clearArrows() {
      let board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
      if (!board) return;
      let overlay = board.querySelector("#assistant-arrow-overlay");
      if (overlay) {
        overlay.innerHTML = "";
      }
    }

    // === Конец функций отрисовки стрелок ===

    // Функция выделения клетки (например, чтобы подсветить куда шла фигурка)
    function highlightSquare(square, color) {
      let board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
      if (!board) return;
      let boardRect = board.getBoundingClientRect();
      let squareSize = boardRect.width / 8;
      let file = square[0];
      let rank = parseInt(square[1], 10);
      let fileIndex = file.charCodeAt(0) - "a".charCodeAt(0);
      let rankIndex;
      if (myColor === "w") {
        rankIndex = 8 - rank;
      } else {
        rankIndex = rank - 1;
        fileIndex = 7 - fileIndex;
      }
      let overlay = document.createElement("div");
      overlay.className = "assistant-square-highlight";
      overlay.style.position = "absolute";
      overlay.style.width = squareSize + "px";
      overlay.style.height = squareSize + "px";
      overlay.style.left = (fileIndex * squareSize) + "px";
      overlay.style.top = (rankIndex * squareSize) + "px";
      overlay.style.backgroundColor = color;
      overlay.style.opacity = "0.5";
      overlay.style.pointerEvents = "none";
      board.appendChild(overlay);
      setTimeout(() => {
        overlay.remove();
      }, 3000);
    }

    // Функция оценки качества последнего хода и подсветки клетки назначения
    // (упрощённая логика: если последний сыгранный ход (из списка) совпадает по клетке назначения с рекомендованным bestmove,
    // то качество = "best" (светло-зеленый); иначе — "blunder" (красный))
    function evaluateLastMoveQuality() {
      let moveListContainer = document.querySelector('.play-controller-moveList.move-list') ||
                              document.querySelector('wc-simple-move-list');
      if (moveListContainer) {
        let moveElements;
        if (myColor === "w") {
          moveElements = moveListContainer.querySelectorAll('.node.white-move');
        } else {
          moveElements = moveListContainer.querySelectorAll('.node.black-move');
        }
        if (moveElements.length > 0) {
          let lastMoveElement = moveElements[moveElements.length - 1];
          let playedDest = lastMoveElement.textContent.trim(); // например, "e4"
          if (lastBestMove && lastBestMove.length >= 4) {
            let bestDest = lastBestMove.substring(2,4);
            let quality;
            if (playedDest === bestDest) {
              quality = "best";
            } else {
              quality = "blunder";
            }
            highlightSquare(playedDest, qualityColors[quality]);
            let qualityDisplay = document.getElementById("move-quality-display");
            if (!qualityDisplay) {
              qualityDisplay = document.createElement("div");
              qualityDisplay.id = "move-quality-display";
              qualityDisplay.style.position = "fixed";
              qualityDisplay.style.bottom = "40px";
              qualityDisplay.style.right = "10px";
              qualityDisplay.style.backgroundColor = "black";
              qualityDisplay.style.color = "white";
              qualityDisplay.style.padding = "5px";
              qualityDisplay.style.borderRadius = "5px";
              qualityDisplay.style.zIndex = "10000";
              document.body.appendChild(qualityDisplay);
            }
            qualityDisplay.textContent = "Move Quality: " + quality;
          }
        }
      }
    }

    // Функция вычисления FEN-строки по расположению фигур
    function calculateFENFromPieces(pieces) {
      let boardMap = Array.from({ length: 8 }, () => Array(8).fill("1"));
      pieces.forEach(piece => {
        let square = null;
        if (piece.parentElement) {
          square = piece.parentElement.getAttribute("data-square");
        }
        if (!square) {
          let squareMatch = piece.className.match(/square-(\d\d)/);
          if (squareMatch) square = squareMatch[1];
        }
        if (!square) return;
        let fileNum, rankNum;
        if (/^[a-h][1-8]$/.test(square)) {
          fileNum = square.charCodeAt(0) - "a".charCodeAt(0) + 1;
          rankNum = parseInt(square[1], 10);
        } else if (/^\d\d$/.test(square)) {
          fileNum = parseInt(square[0], 10);
          rankNum = parseInt(square[1], 10);
        } else {
          return;
        }
        let row = 8 - rankNum;
        let col = fileNum - 1;
        let pieceCode = null;
        piece.classList.forEach(cls => {
          if (/^(w|b)(p|r|n|b|q|k)$/.test(cls)) {
            pieceCode = cls;
          }
        });
        if (!pieceCode) return;
        let color = pieceCode[0];
        let type = pieceCode[1];
        let fenChar = (color === 'w') ? type.toUpperCase() : type.toLowerCase();
        boardMap[row][col] = fenChar;
      });
      let fenRows = boardMap.map(row => {
        let fenRow = "";
        let emptyCount = 0;
        row.forEach(cell => {
          if (cell === "1") {
            emptyCount++;
          } else {
            if (emptyCount > 0) {
              fenRow += emptyCount;
              emptyCount = 0;
            }
            fenRow += cell;
          }
        });
        if (emptyCount > 0) fenRow += emptyCount;
        return fenRow;
      });
      return fenRows.join("/");
    }

    // Функция парсинга оценки из сообщения Stockfish
    function parseScore(message) {
      let parts = message.split(" ");
      let idx = parts.indexOf("score");
      if (idx !== -1 && parts.length > idx + 2) {
        let scoreType = parts[idx + 1];
        let scoreValue = parseInt(parts[idx + 2], 10);
        if (scoreType === "cp") {
          return { type: "cp", value: scoreValue };
        } else if (scoreType === "mate") {
          return { type: "mate", value: scoreValue };
        }
      }
      return null;
    }

    // Функция обновления evaluation bar
    function updateEvaluationBar(scoreInfo) {
      const evalBar = document.getElementById("evaluation-bar");
      const innerBar = document.getElementById("evaluation-bar-inner");
      const evalText = document.getElementById("evaluation-text");
      if (!evalBar || !innerBar || !evalText) return;
      if (scoreInfo.type === "cp") {
        let cp = scoreInfo.value;
        let clamped = Math.max(-300, Math.min(300, cp));
        let percentage = 50 + (clamped / 600) * 100;
        innerBar.style.width = percentage + "%";
        innerBar.style.backgroundColor = cp > 0 ? "green" : cp < 0 ? "red" : "gray";
        evalText.textContent = "Eval: " + cp + " cp";
      } else if (scoreInfo.type === "mate") {
        innerBar.style.width = scoreInfo.value > 0 ? "100%" : "0%";
        innerBar.style.backgroundColor = scoreInfo.value > 0 ? "green" : "red";
        evalText.textContent = "Mate in " + Math.abs(scoreInfo.value);
      }
    }

    // Наблюдение за изменениями доски (MutationObserver с дебаунсингом)
    function observeBoardChanges() {
      let boardContainer = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
      if (!boardContainer) {
        setTimeout(observeBoardChanges, 2000);
        return;
      }
      let debounceTimer = null;
      const observer = new MutationObserver(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          checkBoard();
        }, 1500);
      });
      observer.observe(boardContainer, { childList: true, subtree: true });
    }

    // Периодическая проверка доски (на случай, если MutationObserver не сработал)
    setInterval(() => {
      checkBoard();
    }, 3000);

    setTimeout(checkBoard, 5000);
    setTimeout(observeBoardChanges, 5000);

  }).catch(error => console.error("❌ Ошибка загрузки Stockfish:", error));
})();
