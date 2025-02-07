(function () {
  "use strict";

  // ------------------------
  // Отладка и глобальные настройки
  // ------------------------
  const debug = false;
  function dlog(...args) {
    if (debug) console.log(...args);
  }

  // Глобальные настройки (с сохранением в localStorage)
  let myColor = localStorage.getItem("chessAssistantColor") || "w";
  let assistantDepth = parseInt(localStorage.getItem("chessAssistantDepth"), 10) || 15;
  let assistantShowArrows = localStorage.getItem("chessAssistantShowArrows") === "true";
  let assistantShowMoveHighlight = localStorage.getItem("chessAssistantShowMoveHighlight") === "true";
  // Новый параметр: включено ли расширение (по умолчанию включено)
  let extensionEnabled = localStorage.getItem("chessAssistantEnabled") === "false" ? false : true;

  // Переменные для анализа
  let bestMoves = []; // Массив для хранения рекомендованных ходов (например, два варианта)
  let currentTurn = "w";
  let lastBoardHash = "";

  // Цвета для оценки качества хода
  const qualityColors = {
    brilliant: "#40e0d0",  // бирюзовый
    great: "#add8e6",      // светло-синий
    best: "#90ee90",       // светло-зеленый
    mistake: "orange",
    miss: "#ff4500",       // красно-оранжевый
    blunder: "red"
  };

  // ------------------------
  // Интерфейс пользователя
  // ------------------------

  // Функция делает элемент перетаскиваемым, но не запускает перетаскивание,
  // если клик произошёл по интерактивным элементам (input, button, select, textarea)
  function makeElementDraggable(el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    el.style.cursor = "move";
    el.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (["input", "button", "select", "textarea"].includes(e.target.tagName.toLowerCase())) {
        return;
      }
      e = e || window.event;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      el.style.top = (el.offsetTop - pos2) + "px";
      el.style.left = (el.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // Создание панели настроек с фиксированным размером, ползунком для глубины 
  // и переключателем включения расширения
  function createSettingsPanel() {
    const panel = document.createElement("div");
    panel.id = "chess-assistant-settings";
    Object.assign(panel.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: "250px",      // фиксированная ширина панели
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      color: "white",
      padding: "10px",
      borderRadius: "5px",
      zIndex: "10000",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px"
    });

    // Переключатель включения расширения
    const enableLabel = document.createElement("label");
    enableLabel.textContent = "Включить расширение: ";
    const enableCheckbox = document.createElement("input");
    enableCheckbox.type = "checkbox";
    enableCheckbox.checked = extensionEnabled;
    enableLabel.appendChild(enableCheckbox);

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
    if (myColor === "w") {
      whiteRadio.checked = true;
    } else {
      blackRadio.checked = true;
    }
    colorLabel.appendChild(whiteRadio);
    colorLabel.appendChild(document.createTextNode(" Белые "));
    colorLabel.appendChild(blackRadio);
    colorLabel.appendChild(document.createTextNode(" Черные"));

    // Настройка глубины с использованием ползунка (range input)
    const depthLabel = document.createElement("label");
    depthLabel.textContent = "Глубина: ";
    const depthSlider = document.createElement("input");
    depthSlider.type = "range";
    depthSlider.min = "1";
    depthSlider.max = "20";
    depthSlider.step = "1";
    depthSlider.value = assistantDepth;
    depthSlider.style.width = "100%";
    const depthValue = document.createElement("span");
    depthValue.textContent = assistantDepth;
    const depthContainer = document.createElement("div");
    depthContainer.appendChild(depthSlider);
    depthContainer.appendChild(document.createTextNode(" "));
    depthContainer.appendChild(depthValue);

    // Checkbox для стрелок
    const arrowLabel = document.createElement("label");
    arrowLabel.textContent = " Показывать стрелки: ";
    const arrowCheckbox = document.createElement("input");
    arrowCheckbox.type = "checkbox";
    arrowCheckbox.checked = assistantShowArrows;
    arrowLabel.appendChild(arrowCheckbox);

    // Checkbox для подсветки качества хода
    const highlightLabel = document.createElement("label");
    highlightLabel.textContent = " Показывать подцветку хода: ";
    const highlightCheckbox = document.createElement("input");
    highlightCheckbox.type = "checkbox";
    highlightCheckbox.checked = assistantShowMoveHighlight;
    highlightLabel.appendChild(highlightCheckbox);

    // Добавляем элементы на панель
    panel.appendChild(enableLabel);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(colorLabel);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(depthLabel);
    panel.appendChild(depthContainer);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(arrowLabel);
    panel.appendChild(document.createElement("br"));
    panel.appendChild(highlightLabel);
    document.body.appendChild(panel);

    // Делаем панель перетаскиваемой
    makeElementDraggable(panel);

    // Обработчики изменения настроек
    enableCheckbox.addEventListener("change", () => {
      extensionEnabled = enableCheckbox.checked;
      localStorage.setItem("chessAssistantEnabled", extensionEnabled);
      // Скрываем или показываем элементы интерфейса
      const evalBar = document.getElementById("evaluation-bar");
      if (evalBar) {
        evalBar.style.display = extensionEnabled ? "block" : "none";
      }
      const bestMoveDisplay = document.getElementById("best-move-display");
      if (bestMoveDisplay) {
        bestMoveDisplay.style.display = extensionEnabled ? "block" : "none";
      }
    });

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
    depthSlider.addEventListener("input", () => {
      const val = parseInt(depthSlider.value, 10);
      depthValue.textContent = val;
      localStorage.setItem("chessAssistantDepth", val);
      assistantDepth = val;
    });
    arrowCheckbox.addEventListener("change", () => {
      assistantShowArrows = arrowCheckbox.checked;
      localStorage.setItem("chessAssistantShowArrows", assistantShowArrows);
      if (!assistantShowArrows) clearArrows();
    });
    highlightCheckbox.addEventListener("change", () => {
      assistantShowMoveHighlight = highlightCheckbox.checked;
      localStorage.setItem("chessAssistantShowMoveHighlight", assistantShowMoveHighlight);
    });
  }

  function createEvaluationBar() {
    const evalBar = document.createElement("div");
    evalBar.id = "evaluation-bar";
    Object.assign(evalBar.style, {
      position: "fixed",
      bottom: "50px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "#ddd",
      border: "1px solid #333",
      width: "300px",
      height: "20px",
      borderRadius: "5px",
      overflow: "hidden",
      zIndex: "10000",
      display: extensionEnabled ? "block" : "none"
    });

    const innerBar = document.createElement("div");
    innerBar.id = "evaluation-bar-inner";
    Object.assign(innerBar.style, {
      height: "100%",
      width: "50%", // нейтральное значение
      backgroundColor: "gray"
    });
    evalBar.appendChild(innerBar);

    const evalText = document.createElement("div");
    evalText.id = "evaluation-text";
    Object.assign(evalText.style, {
      position: "absolute",
      top: "0",
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      textAlign: "center",
      fontSize: "12px",
      color: "#000",
      pointerEvents: "none"
    });
    evalBar.appendChild(evalText);

    document.body.appendChild(evalBar);
  }

  // ------------------------
  // Функции для работы с доской и отрисовкой
  // ------------------------

  function getSquareCenter(square, boardRect) {
    const squareSize = boardRect.width / 8;
    const file = square[0];
    const rank = parseInt(square[1], 10);
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
      Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none"
      });
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

  function drawColoredArrow(fromSquare, toSquare, strokeColor) {
    const board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
    const fromCenter = getSquareCenter(fromSquare, boardRect);
    const toCenter = getSquareCenter(toSquare, boardRect);
    const overlay = getArrowOverlay(board);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", fromCenter.x);
    line.setAttribute("y1", fromCenter.y);
    line.setAttribute("x2", toCenter.x);
    line.setAttribute("y2", toCenter.y);
    line.setAttribute("stroke", strokeColor);
    line.setAttribute("stroke-width", "4");
    line.setAttribute("marker-end", "url(#arrowhead)");
    overlay.appendChild(line);
  }

  function clearArrows() {
    const board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
    if (!board) return;
    const overlay = board.querySelector("#assistant-arrow-overlay");
    if (overlay) overlay.innerHTML = "";
  }

  function highlightSquare(square, color) {
    const board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
    if (!board) return;
    const boardRect = board.getBoundingClientRect();
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
    const overlay = document.createElement("div");
    overlay.className = "assistant-square-highlight";
    Object.assign(overlay.style, {
      position: "absolute",
      width: `${squareSize}px`,
      height: `${squareSize}px`,
      left: `${fileIndex * squareSize}px`,
      top: `${rankIndex * squareSize}px`,
      backgroundColor: color,
      opacity: "0.5",
      pointerEvents: "none"
    });
    board.appendChild(overlay);
    setTimeout(() => overlay.remove(), 3000);
  }

  // ------------------------
  // Функции для анализа позиции
  // ------------------------

  function calculateFENFromPieces(pieces) {
    const boardMap = Array.from({ length: 8 }, () => Array(8).fill("1"));
    pieces.forEach(piece => {
      let square = piece.parentElement && piece.parentElement.getAttribute("data-square");
      if (!square) {
        const match = piece.className.match(/square-(\d\d)/);
        if (match) square = match[1];
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
      const row = 8 - rankNum;
      const col = fileNum - 1;
      let pieceCode = null;
      piece.classList.forEach(cls => {
        if (/^(w|b)(p|r|n|b|q|k)$/.test(cls)) {
          pieceCode = cls;
        }
      });
      if (!pieceCode) return;
      const color = pieceCode[0];
      const type = pieceCode[1];
      const fenChar = (color === "w") ? type.toUpperCase() : type.toLowerCase();
      boardMap[row][col] = fenChar;
    });
    return boardMap
      .map(row => {
        let fenRow = "";
        let emptyCount = 0;
        row.forEach(cell => {
          if (cell === "1") {
            emptyCount++;
          } else {
            if (emptyCount) {
              fenRow += emptyCount;
              emptyCount = 0;
            }
            fenRow += cell;
          }
        });
        if (emptyCount) fenRow += emptyCount;
        return fenRow;
      })
      .join("/");
  }

  function parseScore(message) {
    const parts = message.split(" ");
    const idx = parts.indexOf("score");
    if (idx !== -1 && parts.length > idx + 2) {
      const scoreType = parts[idx + 1];
      const scoreValue = parseInt(parts[idx + 2], 10);
      if (scoreType === "cp") {
        return { type: "cp", value: scoreValue };
      } else if (scoreType === "mate") {
        return { type: "mate", value: scoreValue };
      }
    }
    return null;
  }

  function updateEvaluationBar(scoreInfo) {
    const evalBar = document.getElementById("evaluation-bar");
    const innerBar = document.getElementById("evaluation-bar-inner");
    const evalText = document.getElementById("evaluation-text");
    if (!evalBar || !innerBar || !evalText) return;
    if (scoreInfo.type === "cp") {
      const cp = scoreInfo.value;
      const percentage = 50 + Math.tanh(cp / 300) * 50;
      innerBar.style.width = `${percentage}%`;
      innerBar.style.backgroundColor = cp > 0 ? "green" : "red";
      evalText.textContent = "Eval: " + cp + " cp";
    } else if (scoreInfo.type === "mate") {
      innerBar.style.width = "50%";
      innerBar.style.backgroundColor = "gray";
      evalText.textContent = "Mate in " + Math.abs(scoreInfo.value);
    }
  }

  // ------------------------
  // Работа со Stockfish
  // ------------------------

  function createStockfishWorker() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
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
        reject(new Error("Ошибка сети при загрузке Stockfish.js"));
      };
      xhr.send();
    });
  }

  // ------------------------
  // Основая логика анализа доски
  // ------------------------

  function analyzePosition(fen) {
    dlog("Отправляем FEN в Stockfish:", fen);
    stockfish.postMessage("position fen " + fen);
    stockfish.postMessage("go depth " + assistantDepth);
  }

  function showBestMoves(moves) {
    let moveDisplay = document.getElementById("best-move-display");
    if (!moveDisplay) {
      moveDisplay = document.createElement("div");
      moveDisplay.id = "best-move-display";
      Object.assign(moveDisplay.style, {
        position: "fixed",
        bottom: "10px",
        right: "10px",
        backgroundColor: "black",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        zIndex: "10000",
        display: extensionEnabled ? "block" : "none"
      });
      document.body.appendChild(moveDisplay);
    }
    moveDisplay.innerText = "Рекомендованные ходы: " + moves.join(", ");
    if (assistantShowArrows) {
      clearArrows();
      moves.forEach((move, idx) => {
        if (move.length >= 4) {
          const fromSquare = move.substring(0, 2);
          const toSquare = move.substring(2, 4);
          const arrowColor = (idx === 0) ? "green" : "blue";
          drawColoredArrow(fromSquare, toSquare, arrowColor);
        }
      });
    }
  }

  function clearSuggestion() {
    const moveDisplay = document.getElementById("best-move-display");
    if (moveDisplay) moveDisplay.innerText = "";
    clearArrows();
  }

  function getCurrentTurnFromMoveList() {
    const moveListContainer = document.querySelector('.play-controller-moveList.move.list') ||
                              document.querySelector('wc-simple-move-list');
    if (moveListContainer) {
      const whiteMoves = moveListContainer.querySelectorAll('.node.white-move');
      const blackMoves = moveListContainer.querySelectorAll('.node.black-move');
      dlog("White moves:", whiteMoves.length, "Black moves:", blackMoves.length);
      return (whiteMoves.length === blackMoves.length) ? "w" : "b";
    }
    return null;
  }

  function computeBoardHash() {
    const pieces = document.querySelectorAll(".piece");
    return calculateFENFromPieces(pieces);
  }

  function evaluateLastMoveQuality() {
    const moveListContainer = document.querySelector('.play-controller-moveList.move.list') ||
                              document.querySelector('wc-simple-move-list');
    if (moveListContainer) {
      const moveElements = myColor === "w"
        ? moveListContainer.querySelectorAll('.node.white-move')
        : moveListContainer.querySelectorAll('.node.black-move');
      if (moveElements.length > 0) {
        const lastMoveElement = moveElements[moveElements.length - 1];
        const playedDest = lastMoveElement.textContent.trim();
        if (bestMoves.length > 0 && bestMoves[0] && bestMoves[0].length >= 4) {
          const bestDest = bestMoves[0].substring(2, 4);
          const quality = (playedDest === bestDest) ? "best" : "blunder";
          if (assistantShowMoveHighlight) {
            highlightSquare(playedDest, qualityColors[quality]);
          }
          let qualityDisplay = document.getElementById("move-quality-display");
          if (!qualityDisplay) {
            qualityDisplay = document.createElement("div");
            qualityDisplay.id = "move-quality-display";
            Object.assign(qualityDisplay.style, {
              position: "fixed",
              bottom: "40px",
              right: "10px",
              backgroundColor: "black",
              color: "white",
              padding: "5px",
              borderRadius: "5px",
              zIndex: "10000"
            });
            document.body.appendChild(qualityDisplay);
          }
          qualityDisplay.textContent = "Move Quality: " + quality;
        }
      }
    }
  }

  function checkBoard() {
    // Если расширение отключено, не анализируем доску
    if (!extensionEnabled) return;
    const board = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
    if (!board) {
      dlog("Шахматная доска не найдена!");
      return;
    }
    const turnFromList = getCurrentTurnFromMoveList();
    if (turnFromList !== null) {
      currentTurn = turnFromList;
      dlog("Определено через список ходов: сейчас ход", currentTurn);
    } else {
      const boardHash = computeBoardHash();
      dlog("Вычисленный хеш позиции:", boardHash);
      if (!lastBoardHash) {
        lastBoardHash = boardHash;
      } else if (boardHash !== lastBoardHash) {
        currentTurn = (currentTurn === "w") ? "b" : "w";
        dlog("Позиция изменилась. Теперь ход:", currentTurn);
        lastBoardHash = boardHash;
      }
    }
    if (currentTurn !== myColor) {
      dlog("Сейчас ход", currentTurn, "(не мой, мой цвет:", myColor, "). Оценка последнего хода.");
      if (assistantShowMoveHighlight) evaluateLastMoveQuality();
      clearSuggestion();
      return;
    }
    const fen = computeBoardHash() + " " + currentTurn + " - - 0 1";
    dlog("Мой ход. FEN:", fen);
    analyzePosition(fen);
  }

  function observeBoardChanges() {
    const boardContainer = document.querySelector(".board") || document.querySelector("[board-id='board-single']");
    if (!boardContainer) {
      setTimeout(observeBoardChanges, 2000);
      return;
    }
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkBoard, 1500);
    });
    observer.observe(boardContainer, { childList: true, subtree: true });
  }

  // ------------------------
  // Инициализация Stockfish и запуск анализа
  // ------------------------
  let stockfish;
  createStockfishWorker()
    .then(sf => {
      stockfish = sf;
      dlog("Stockfish загружен");

      stockfish.postMessage("uci");
      stockfish.postMessage("setoption name MultiPV value 2");
      stockfish.postMessage("isready");

      stockfish.onmessage = function (event) {
        const msg = event.data;
        if (msg.startsWith("info") && msg.indexOf("multipv") !== -1) {
          const tokens = msg.split(" ");
          const mpIndex = tokens.indexOf("multipv");
          if (mpIndex !== -1 && tokens.length > mpIndex + 1) {
            const mp = parseInt(tokens[mpIndex + 1], 10);
            const pvIndex = tokens.indexOf("pv");
            if (pvIndex !== -1 && tokens.length > pvIndex + 1) {
              const move = tokens[pvIndex + 1];
              bestMoves[mp - 1] = move;
            }
          }
          if (msg.indexOf("score") !== -1) {
            const scoreInfo = parseScore(msg);
            if (scoreInfo && scoreInfo.type) {
              updateEvaluationBar(scoreInfo);
            }
          }
        }
        if (msg.startsWith("bestmove")) {
          if (bestMoves.length > 0) {
            showBestMoves(bestMoves);
          }
        }
      };

      setInterval(checkBoard, 3000);
      setTimeout(checkBoard, 5000);
      setTimeout(observeBoardChanges, 5000);
    })
    .catch(error => console.error("Ошибка загрузки Stockfish:", error));

  // ------------------------
  // Запуск интерфейса
  // ------------------------
  createSettingsPanel();
  createEvaluationBar();

})();
