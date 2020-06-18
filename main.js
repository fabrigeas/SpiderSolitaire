// global variables

var stackToBeMoved = [];
var score = 0;
var moves = 0;

var gameTimer,
  numberOfCompleteStacks = 0,
  numberOfStacks = 13,
  splitIndex = 5,
  scoreDOM,
  movesDOM,
  // Game object
  game = {},
  // DOM objects
  bank,
  stacks,
  completedStacks,
  cards;

var config = {
  numberOfStacks: 13,
  numberOfColors: 4, // set this to 0 in order to use 4 colors
  cardMargin: 2, // The value of each card's marginTop
  initialNumberOfCardsPerStack: 3, // The number of cards to be distributed when the game starts
  numberOfcorrectCards: 13, // The required number of cards for a successful complete stack
};

var gameMenu = {};

/**
 *  An IIFE function as a document ready state change event handler
 */
(function () {
  initGameMenu();
  initGame();
  registerServiceWorker();
})();

/** Initializes the game menu
 *
 */
function initGameMenu() {
  gameMenu.modal = document.querySelector(".modal");
  gameMenu.showGameMenuButton = document.getElementById("showGameMenuButton");

  gameMenu.newGameButton = document.getElementById("newGameButton");
  gameMenu.startGameButton = document.getElementById("startGameButton");
  gameMenu.restartGameButton = document.getElementById("restartGameButton");
  gameMenu.resumeGameButton = document.getElementById("resumeGameButton");
  gameMenu.exitGameButton = document.getElementById("exitGameButton");

  gameMenu.newGameMenu = document.getElementById("newGameMenu");
  gameMenu.pausedGameMenu = document.getElementById("pausedGameMenu");

  gameMenu.exitGameButton.onclick = () => location.reload(true);
  gameMenu.startGameButton.onclick = () => startGame();
  gameMenu.restartGameButton.onclick = () => startGame();
  gameMenu.resumeGameButton.onclick = () => startGame(true);
}

/** Initialize the game
 *
 */
function initGame() {
  game = {
    timer: new GameTimer(),
    isPlaying: false,
  };

  let panel = document.getElementById("panel"),
    completed = document.querySelector(".stack.completed"); // a div that contains the stacks of completed cards

  for (let i = config.numberOfStacks; i > -1; i--) {
    panel.appendChild(createStackDOM(i)); // create stacks
    completed.appendChild(document.createElement("div")); // Create stack placeholders for completed card
  }

  completedStacks = completed.children;

  //init global DOM variables
  stacks = document.querySelectorAll(".stacks");
  bank = document.querySelector(".bank");
  scoreDOM = document.getElementById("score");
  movesDOM = document.getElementById("moves");
  gameTimer = new GameTimer();

  showPauseMenu(false);
}

/** Initializes the service worker to provide offline experience
 *
 */
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker
        .register("/serviceWorker.js")
        .then(() => {})
        .catch((error) => console.error("Failed to register service worker", error));
    });
  }
}

/** un-registers the service worker
 *
 */
function unregister() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}

/** Start, restart or resume a game
 *
 * @param {Boolean} resumeGame If this parameter is given or if it is true,
 * the resume game funtionality will be executed. This means new cards will not be distributed,
 * and only the game pause menu will be hidden
 *
 */
function startGame(resumeGame) {
  if (resumeGame) {
  } else {
    document.querySelectorAll(".card").forEach((card) => card.remove());

    game.isPlaying = true;
    config.numberOfColors = parseInt(
      document.querySelector("input[name=numberOfColors]:checked").value
    );

    //put all the cards in the bank
    CardGenerator(config.numberOfColors).forEach((card) =>
      addCardToStack(createCard(card, -1, true), bank)
    );

    for (let i = 0; i < config.initialNumberOfCardsPerStack; i++) {
      maskEachLastCard();
      distributeCards(true);
    }

    gameTimer.start();
  }

  showPauseMenu(true);
}

/** Close the game menu modal,
 * but before, stop the game timer
 *
 * @param {Boolean} hide if this parameter is true or persent, the game meni will be hidden.
 */
function showPauseMenu(hide) {
  const isPlaying = game.isPlaying;

  gameMenu.pausedGameMenu.hidden = !isPlaying;
  gameMenu.newGameMenu.hidden = isPlaying;

  if (hide) {
    gameMenu.modal.hidden = true;
    gameTimer.start();
  } else {
    gameMenu.modal.hidden = false;
    gameTimer.stop();
  }
}

/** Create a Card Element
 *
 * @param {Object} stackNumber The object containing the card to be created
 * The properties of a card include number, text, color
 */
function createStackDOM(stackNumber) {
  let stackDom = document.createElement("div"),
    classList = stackNumber ? `stack stacks ${stackNumber}` : "stack bank";

  stackDom.classList = classList;
  stackDom.ondragenter = entered;
  stackDom.ondragover = entered;
  stackDom.ondrop = onDropped;

  return stackDom;
}

/** Create a card dom
 *
 * @param {Object} card The object containing that card data {color, text, number}
 * @param {Number} margin an nteger corresponding to the marginTop of the card. Which is simply computed from the previousElement.style.marginTop
 * @param {Boolean} hidden if this value is set, the card will be hidden
 */
function createCard(card, margin, hidden) {
  let cardDOM = document.createElement("div");

  cardDOM.classList.add("card", card.color);

  cardDOM.innerHTML = `<div class='number'><h3>${card.text}</h3></div>`;
  cardDOM.draggable = true;
  cardDOM.dataset.text = card.text;
  cardDOM.dataset.number = card.number;
  cardDOM.dataset.color = card.color;

  cardDOM.ondragstart = dragStart;
  cardDOM.ondrag = dragStack;
  cardDOM.ondragend = dragEnd;

  cardDOM.style.marginTop = `${margin}rem`;

  if (hidden) {
    maskCard(cardDOM, true);
    cardDOM.onclick = distributeCards;
  }
  return cardDOM;
}

/** Event handler triggered when a card drag begins
 * In this function, the card to be moved is being marked
 * @param {Event} event
 */
function dragStart(event) {
  let card = event.target,
    next = card,
    previousNumber = parseInt(card.dataset.number);

  stackToBeMoved = [card];

  while ((next = next.nextElementSibling) != null) {
    let currentNumber = parseInt(next.dataset.number);

    if (previousNumber == currentNumber + 1) {
      next.classList.add("moving");
      stackToBeMoved.push(next);
    } else {
      cancelMoveOperation();
      return event.preventDefault();
    }

    previousNumber = currentNumber;
  }

  card.style.height =
    stackToBeMoved.length * 32 - 32 + card.offsetHeight + "px";
  card.classList.add("moving");
  card.parentElement.classList.add("old");

  stackToBeMoved.forEach((card) =>
    setTimeout(() => card.classList.add("hide"))
  );
}

/** Event handler for ondrag.
 * Here the cards that are attached to the dragged card are also moved.
 * For example if the card being moved is a 5, attached cards would be 4,3,2 ... and so on (of the same color)
 *
 * @param {*} event
 */
function dragStack(event) {
  stackToBeMoved.forEach((card) => {
    card.offsetTop += event.screenY;
    card.offsetLeft += event.screenX;
  });
}

/** Event handler for ondragend
 *
 * @param {Event} event
 */
function dragEnd(event) {
  event.target.classList.remove("hide");
  removeCardOver();

  let card = event.target;

  card.classList.remove("moving");
  card.style.height = "";
  stackToBeMoved.forEach((card) => card.classList.remove("hide"));
  event.preventDefault();
}

/** Event handler for ondragover
 * This simply highlights the stack where the dragged card is passing
 *
 * @param {Event} event
 */
function entered(event) {
  event.preventDefault();

  removeCardOver();
  this.classList.add("over");
}

function onDropped(event) {
  let newStack = event.currentTarget,
    oldStack = document.querySelector(".stack.old"),
    card = document.querySelector(".card.moving"),
    source = card.dataset,
    lastCard = newStack.lastElementChild;

  if (oldStack == newStack) {
    return cancelMoveOperation();
  }

  let top = parseInt(source.number),
    bottom = lastCard ? parseInt(lastCard.dataset.number) : top + 1;

  if (bottom == top + 1 && lastCard.dataset.color == card.dataset.color) {
    maskCard(card.previousElementSibling, false);

    oldStack.classList.remove("old");
    stackToBeMoved.forEach((card) => addCardToStack(card, newStack));

    checkStackComplete(newStack.querySelectorAll("[data-number='1']"));

    movesDOM.textContent = ++moves;
  } else {
    return cancelMoveOperation();
  }
}

/** Mask the given card
 *
 * @param {HTMLElement} card The cardDOM
 * @param {Boolean} show if true, hide the card, make it undraggable and unclickable otherwise
 */
function maskCard(cardDOM, show) {
  if (!cardDOM) {
    return;
  }

  if (!show) {
    cardDOM.classList.remove("hidden");
    cardDOM.draggable = true;
  } else {
    cardDOM.classList.add("hidden");
    cardDOM.draggable = false;
  }
}

/** Cancel a drag operation and return the dragged cards back to their original stack
 *
 */
function cancelMoveOperation() {
  stackToBeMoved.forEach((card) => card.classList.remove("moving"));
}

/** Remove the class over from the stacks.
 * This function is used before addeing .over to any stack
 * so as to avoid multiple stacks to have the class .over
 */
function removeCardOver() {
  let over = document.querySelector(".over");

  if (over) {
    over.classList.remove("over");
  }
}

/** Given a card, check that the card can validly be appended to the given stack.
 * If the card can be validly appended, append it, update the card's margin
 * check if the there is a stack completed.
 *
 * Otherwise cancelMoveOperation();
 *
 * @param {CardDOM} card The card to be appended
 * @param {StackDOM} newStack The destination stack
 */
function addCardToStack(card, newStack) {
  let margin = 0;

  //if the card is moving and the newStack is not "stackOfCompletedCards"
  if (!card.classList.contains("hidden") && newStack.classList.value) {
    let lastElementChild = newStack.lastElementChild,
      lastMargin = lastElementChild
        ? parseInt(lastElementChild.style.marginTop)
        : 0;

    margin = lastElementChild ? lastMargin + config.cardMargin : 0;
  }

  card.classList.remove("moving");
  card.style.marginTop = `${margin}rem`;
  newStack.appendChild(card);
}

/** Checks if the given tails array contains a valid collection of cards
 * numbered 1-13, if yes, remove thes complete stack and update the score
 *
 * @param {Array} tails
 */
function checkStackComplete(tails) {
  tails.forEach((card) => {
    let currentNumber = card.dataset.number;
    let accumulator = [card];

    while ((card = card.previousSibling)) {
      let previousNumber = card.dataset.number;

      if (card.classList.contains("hidden")) {
        return;
      }

      if (currentNumber == previousNumber - 1) {
        accumulator.push(card);
      } else {
      }

      if (accumulator.length == config.numberOfcorrectCards) {
        moveStackToCompleted(accumulator, card.previousElementSibling);
        score += 100 - moves;
        scoreDOM.textContent = score;
      }

      currentNumber = previousNumber;
    }
  });
}

/** Move the given stack of card into a stack of completed cards
 *
 * @param {Array} stack An array containing the cards that have been successfully collected
 * @param {CardDOM} card The last card from where the stack has been collected. This can be null. This card is required so that it can be unmasked. see mask()
 */
function moveStackToCompleted(stack, card) {
  stack.forEach((card) => {
    card.classList.add("hidden");
    addCardToStack(card, completedStacks[numberOfCompleteStacks]);
  });
  maskCard(card, false);
  numberOfCompleteStacks += 1;
}

/** This function is called before distributing cards when the game begins.
 *
 */
function maskEachLastCard() {
  stacks.forEach((stack) => {
    card = stack.lastElementChild;
    if (card) {
      maskCard(card, true);
    } else {
      return;
    }
  });
}

/** Distribute cards to each of the stacks.
 * forEach stack, extract a card from the bank and drop it on the stack
 *
 * @param {Boolean} hideCards If true, The distributed cards will be hidden
 */
function distributeCards() {
  stacks.forEach((stack) => {
    let card = bank.lastElementChild;

    if (card) {
      maskCard(card, false);
      card.onclick = null;
      addCardToStack(card, stack);
    } else {
      return;
    }
  });
}

/** A class that returns a deck of cards based on the number of colors given
 *
 * @param {Number} numberOfColors A number[1-4] corresponding to the number of colors to be used for the game.
 * This number is synonym to game difficulty.
 */
function CardGenerator(numberOfColors) {
  this.generateCards = () => {
    let numbers = [
      { text: "A", value: 1 },
      { text: "2", value: 2 },
      { text: "3", value: 3 },
      { text: "4", value: 4 },
      { text: "5", value: 5 },
      { text: "6", value: 6 },
      { text: "7", value: 7 },
      { text: "8", value: 8 },
      { text: "9", value: 9 },
      { text: "10", value: 10 },
      { text: "J", value: 11 },
      { text: "Q", value: 12 },
      { text: "K", value: 13 },
    ];

    let names = ["diamond", "heart", "club", "spade"].slice(4 - numberOfColors),
      deck = [],
      result = [];

    // multiply the card numbers by 4
    for (let i = 0; i < 4; i++) {
      deck = deck.concat(numbers);
    }

    deck.forEach((number) => {
      names.forEach((name) => {
        result.push({
          color: name,
          text: number.text,
          number: number.value,
        });
      });
    });

    return result;
  };

  this.shuffleCards = (array) => {
    let counter = array.length;

    while (counter > 0) {
      let index = Math.floor(Math.random() * counter);

      // Decrease counter by 1
      counter--;

      // And swap the last element with it
      let temp = array[counter];
      array[counter] = array[index];
      array[index] = temp;
    }

    return array;
  };

  let cards = this.generateCards();
  return this.shuffleCards(cards);
}

/** The Game Timer class containing the follofing methods:
 * start: Start the timer
 * stop: Stop or pause the timmer
 * reset: reset the time to 00:00:00
 */
function GameTimer() {
  this.h = 0;
  this.m = 0;
  this.s = 0;
  this.timeDOM = document.getElementById("time");
  this.timer;

  this.start = () => this.addSecond(this);

  this.addSecond = (that) => {
    if (++that.s > 59) {
      that.s = 0;
      that.m++;

      if (that.m > 59) {
        m = 0;
        h++;
      }
    }

    that.displayTime();
    that.timer = setTimeout(() => that.addSecond(that), 1000);
  };

  this.reset = () => {
    this.h = this.m = this.s = 0;
    this.displayTime();
  };

  // Stop the timer
  this.stop = () => clearTimeout(this.timer);

  // Update the time in the timer DOM
  this.displayTime = () =>
    (this.timeDOM.textContent = `${this.beautifyTime(
      this.h
    )}:${this.beautifyTime(this.m)}:${this.beautifyTime(this.s)}`);

  /** Formats the unit into a 2-digit value
   *  @param {Number} unit The unit to be formatted
   *
   */
  this.beautifyTime = (unit) => (unit < 10 ? `0${unit}` : unit);

  // Returns an object containing the current elapsed time
  this.getElapsedTime = () => ({
    hours: this.h,
    minutes: this.m,
    seconds: this.s,
  });
}

/** Generate a random integer x: x = [min, max]
 *
 * @param {Number} min The minumum value inclusive
 * @param {Number} max The maximum value inclusive
 */
function getRandomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}
