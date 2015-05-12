(function(){
  var storage = {};
  var app = angular.module("app",[]);
  var $statsScope;
  var $todoScope;
  var $timerScope;

  /**
  * Controller for all stat functions
  **/
  app.controller("StatsController", ['$scope', function($scope){
    $statsScope = $scope;
    $scope.newPet = true;
    $scope.petRanAway = false;
    $scope.petName = '';
    $scope.lastDateAccessed = new Date();
    setAdjustStatsAlarm();

    /**
    * Get stored stats
    **/
    chrome.storage.sync.get(['stats','petName','lastDateAccessed'], function(result){
      if(!(result.stats === undefined) && !$scope.petRanAway){
        $scope.stats = result.stats;
        $scope.newPet = false;
        $scope.petName = result.petName;
        $scope.lastDateAccessed = new Date(result.lastDateAccessed);
        $scope.adjustStats();
        $scope.$apply();
      }
    });

    /**
    * Instantiates all pet information for new pet
    **/
    $scope.createPet = function(){
      $scope.newPet = false;
      $scope.petRanAway = false;
      $scope.stats = {discipline:50.0, happiness:100.0, hunger:100.0, coins:100};
      storage['stats'] = $scope.stats;
      storage['petName'] = $scope.petName;
      $scope.lastDateAccessed = new Date();
      storage['lastDateAccessed'] = $scope.lastDateAccessed.toString();
      chrome.storage.sync.set(storage)
    };

    /**
    * Adjusts Hunger and Happiness based on time passed since last access
    **/
    $scope.adjustStats = function(){
      checkForRunAway();
      if($scope.lastDateAccessed != undefined){
        var decrementAmount = 0;
        var incrementingDate = new Date($scope.lastDateAccessed.toString());
        while(incrementingDate.setMinutes(incrementingDate.getMinutes() + 10) < new Date()){
          decrementAmount++;
          $scope.lastDateAccessed.setMinutes($scope.lastDateAccessed.getMinutes()+10);
        }

        $scope.stats['hunger'] -= decrementAmount;
        if($scope.stats['hunger'] <= 0){
          $scope.stats['hunger'] = 0;
          subDiscipline(decrementAmount);
        }

        $scope.stats['happiness'] -= decrementAmount;
        if($scope.stats['happiness'] <= 0){
          $scope.stats['happiness'] = 0;
          subDiscipline(decrementAmount);
        }

        storage['lastDateAccessed'] = $scope.lastDateAccessed.toString();

        saveStats();
      }
    }

    /**
    * Brings user to create new pet screen
    **/
    $scope.rebirth = function(){
      $scope.newPet = true;
      $scope.$apply();
    }

    /**
    * Forces pet to run away
    * Only used for debugging purposes
    **/
    $scope.kill = function(){
      subDiscipline(100);
      saveStats();
    }
  }])

  /**
  * Controller for all todo list functions
  **/
  app.controller("TodoController", ['$scope', function($scope){
    $todoScope = $scope;
    $scope.todos = [];
    //setDailyAlarm();

    /**
    * Get stored todos
    **/
    chrome.storage.sync.get('todos', function(result){
      if(result.todos === undefined){
        $scope.todos = [];
      } else {
        $scope.todos = result.todos;
        $scope.$apply();
      }
    });

    /**
    * Adds a todo from the popup to the list upon submit
    **/
    $scope.addTodo = function(){
      $scope.todos.push({text:$scope.todoText, done:false});
      $scope.todoText='';
      chrome.storage.sync.remove('todos', function(){
        storage['todos'] = $scope.todos;
        chrome.storage.sync.set(storage)
      });
    };

    /**
    * Updates the list of todos in the storage to keep checkboxes correct throughout sessions
    **/
    $scope.updateTodos = function(){
      storage['todos'] = $scope.todos;
      chrome.storage.sync.set(storage);
    };

    /**
    * Clear the completed todos
    **/
    $scope.clearCompletedTodos = function(){
      chrome.storage.sync.get('todos', function(result){
        var todos = result.todos;
        var completeCount = 0;
        var newTodos = [];
        for(todo in todos){
          if(todos[todo].done){
            completeCount++;
          } else {
            newTodos.push(todos[todo]);
          }
        }

        $scope.todos = newTodos;
        storage['todos'] = newTodos;

        chrome.storage.sync.remove('todos', function(){
          chrome.storage.sync.set(storage);
          $scope.$apply();
        })

        completeTodosBonus(completeCount);
      })
    }


    /**
    * Sets an alarm to repeat daily
    * Used to clear todos at the end of the day
    **** Currently not in use!
    **/
    function setDailyAlarm(){
      var nextDay = new Date();
      nextDay.setHours(0,0,0,0);
      nextDay.setDate(nextDay.getDate() + 1);
      var minutesInADay = 60 * 24;
      chrome.alarms.create("dailyTodoAlarm", {when: nextDay.getTime(), periodInMinutes: minutesInADay});
    }

    /**
    * Counts up and then clears all todos
    **/
    function dailyAlarmTodoWipe(){
      chrome.storage.sync.get('todos', function(result){
        var todos = result.todos;
        var completeCount = 0;
        var incompleteCount = 0;
        for (todo in todos){
          if(todos[todo].done){
            completeCount++;
          } else {
            incompleteCount++;
          }
        }

        $todoScope.todos = [];
        storage['todos'] = [];

        chrome.storage.sync.set(storage);

        completeTodosBonus(completeCount);
        incompleteTodosPenalty(incompleteCount);

        $todoScope.$apply();
      });
    }

    /**
    * Awards appropriately for given number of completed todos
    **/
    function completeTodosBonus(numComplete){
      var coinsToAdd = numComplete * 10;
      addCoins(coinsToAdd);

      var disciplineToAdd = numComplete * 5;
      addDiscipline(disciplineToAdd);
    }

    /**
    * Penalizes appropriately for given number of incomplete todos
    **/
    function incompleteTodosPenalty(numIncomplete){
      var statMax = 100;
      var disciplineToSub = numIncomplete / ($statsScope.stats['hunger'] / statMax) + numIncomplete / ($statsScope.stats['happiness'] / statMax);
      subDiscipline(disciplineToSub);
    }
  }]);

  /**
  * Controller for handling all website blocking functionality
  **/
  app.controller("BlockerController", ['$scope', function($scope){
    $scope.siteList = [];

    /**
    * Check if there is already a list of sites to block
    **/
    chrome.storage.sync.get('siteList', function(result){
      if(result.siteList === undefined){
        $scope.siteList = [];
      } else {
        $scope.siteList = result.siteList;
        $scope.$apply();
      }
    });

    /**
    * Add a new blocked site to the list
    **/
    $scope.blockSite = function(){
      $scope.siteList.push($scope.siteURL);
      $scope.siteURL='';
      chrome.storage.sync.remove('siteList', function(){
        storage['siteList'] = $scope.siteList;
        chrome.storage.sync.set(storage);
      });
    }

    /**
    * Remove a blocked site from the list
    **/
    $scope.removeBlockedSite = function(siteName){
      var siteIndex = $scope.siteList.indexOf(siteName);
      $scope.siteList.splice(siteIndex,1);
      chrome.storage.sync.remove('siteList', function(){
        storage['siteList'] = $scope.siteList;
        chrome.storage.sync.set(storage);
      });
      $scope.$apply();
    }

    /**
    * Function for continuing to site when continue button is pressed on blocked.html
    **/
    $scope.continueToSite = function(){
      backgroundPage = chrome.extension.getBackgroundPage();
      backgroundPage.allowedToViewBlockedSites = true;
      var site = backgroundPage.attemptedURL;
      var tabId = backgroundPage.lastBlockedTabId;
      subDiscipline(10);
      chrome.tabs.update(tabId, {"url" : site},
        function () {});
    }
  }])

  /**
  * Controller for the shop functionality
  **/
  app.controller('ShopController', ['$scope', function($scope){
    $scope.foods = [
      {"name": "orange", "hungerRestored": 5, "coinsLost": 10},
      {"name": "cake", "hungerRestored": 20, "coinsLost": 30},
      {"name": "meal", "hungerRestored": 100, "coinsLost": 100}
    ];

    $scope.buyFood = function(food){
      if(($statsScope.stats['coins'] - food.coinsLost) >= 0){
        subCoins(food.coinsLost);
        addHunger(food.hungerRestored);
      }
    }
  }])

  /**
  * Controller for the minigame
  **/
  app.controller('MinigameController', ['$scope', function($scope){
    GameStates = {};
    GameStates.Menu = function(){};

    /**
    * Code for the main menu of the game
    **/
    GameStates.Menu.prototype = {
      preload: function(){
        game.load.image('bg', 'img/bg.png');
        game.load.image('pet', 'img/icon.png');
        game.load.image('minigameButton', 'img/minigamebutton.png');
        var minigameButton;
      },

      create: function(){
        game.add.sprite(0,0,'bg');
        pet = game.add.sprite(100,150,'pet');
        minigameButton = game.add.button(70,80,'minigameButton', this.switchToMinigame);
      },

      update: function(){

      },

      switchToMinigame: function(){
        game.state.start('Minigame');
      }
    }

    /**
    * Code for the minigame game logic
    **/
    GameStates.Minigame = function(){};
    GameStates.Minigame.prototype = {
      preload: function() {
        game.load.image('bg', 'img/bg.png');
        game.load.image('pet', 'img/icon.png');
        game.load.image('star', 'img/star.png');
        var pet;
        var stars;
        var points;
        var scoreText;
      },

      create: function() {
        game.physics.startSystem(Phaser.Physics.ARCADE);
        game.add.sprite(0,0,'bg');
        pet = game.add.sprite(100,150,'pet');
        stars = game.add.group();
        stars.enableBody = true;
        points = 0;
        scoreText = game.add.text(5, 5, "Score: " + points);

        game.physics.arcade.enable(pet);

        pet.body.bounce.y = 0.2;
        pet.body.gravity.y = 300;
        pet.body.collideWorldBounds = true;

        cursors = game.input.keyboard.createCursorKeys();

        spawnStars();
      },

      update: function() {
        pet.body.velocity.x = 0;

        if(cursors.right.isDown){
          pet.body.velocity.x = 150;
        } else if(cursors.left.isDown){
          pet.body.velocity.x = -150;
        }

        game.physics.arcade.overlap(pet, stars, collectStar, null, this);

        stars.forEach(function(star){
          checkForGameOver(star);
        }, this);
      }
    }


    var game = new Phaser.Game(240, 200, Phaser.AUTO, 'game-area');

    game.state.add('Menu', GameStates.Menu);
    game.state.add('Minigame', GameStates.Minigame);
    game.state.start('Menu');


    /**
    * Function to call when a star is touched (collected) by the pet
    **/
    function collectStar(pet, star){
      star.kill();
      points++;
      scoreText.setText("Score: " + points);
    }

    /**
    * Function to check if the star has touched the bounds on every update
    **/
    function checkForGameOver(star){
      if(star.body.bottom > game.world.bounds.bottom){
        gameOver(star);
      }
    }

    /**
    * A star has fallen. Game over to return back to menu
    **/
    function gameOver(star){
      star.kill();
      addHappiness(points);
      game.state.start('Menu');
    }

    /**
    * Random star spawning function
    **/
    function spawnStars(){
      var starGravity = 130;
      var starRandomX = Math.random() * (game.world.bounds.right - 24);
      var star = stars.create(starRandomX,0,'star');
      star.body.gravity.y = starGravity;
      var timeUntilNewStar = (Math.random()*1000) + 1000;
      timeUntilNewStar = parseInt(timeUntilNewStar);
      var waitToSpawnNewStar = setTimeout(spawnStars, timeUntilNewStar);
    }

    $scope.game = game;
  }])

  /**
  * Controller for all of the work/break timer functionality
  **/
  app.controller('TimerController', ['$scope', function($scope){
    chrome.runtime.getBackgroundPage(function(page){
      $scope.isBreakTime = page.isBreakTime;
      $scope.timerRunning = (page.timerId === undefined) ? false : true;
    })

    /**
    * Function to start the work timer
    **/
    $scope.startTimer = function(){
      chrome.runtime.getBackgroundPage(function(page) {
        page.timerRequest($scope.workTimer, $scope.breakTimer);
        $scope.isBreakTime = false;
        $scope.timerRunning = true;
        $scope.$apply();
      });
    }

    /**
    * Function to stop the work/break timer
    **/
    $scope.stopTimer = function(){
      chrome.runtime.getBackgroundPage(function(page) {
        page.timerStop();
        $scope.isBreakTime = true;
        $scope.timerRunning = false;
        $scope.$apply();
      });
    }

    $timerScope = $scope;
  }])


  /**
  * Sets an alarm to check if hunger and happiness have decreased occasionally
  * Only purpose is to update visually the progress bars of hunger and happiness while user is looking at them
  **/
  function setAdjustStatsAlarm(){
    var nextAdjustmentDate = new Date();
    nextAdjustmentDate.setMinutes(nextAdjustmentDate.getMinutes() + 1);
    chrome.alarms.create("adjustStatsAlarm", {when: nextAdjustmentDate.getTime()});
  }


  /**
  * Listener that waits for an alarm and calls appropriate alarm function for the alarm
  **/
  chrome.alarms.onAlarm.addListener(function(alarm){
    if(alarm.name === "dailyTodoAlarm"){
      dailyAlarmTodoWipe();
    } else if(alarm.name === "adjustStatsAlarm"){
      $statsScope.adjustStats();
      setAdjustStatsAlarm();
    }
  });



  /**
  * Adds the amount of coins given
  **/
  function addCoins(coins){
    $statsScope.stats['coins'] += coins;
    saveStats();
  }

  /**
  * Subs the amount of coins given
  **/
  function subCoins(coins){
    $statsScope.stats['coins'] -= coins;
    saveStats();
  }

  function addHappiness(happiness){
    $statsScope.stats['happiness'] += happiness;
    if($statsScope.stats['happiness'] > 100) $statsScope.stats['happiness'] = 100;
    saveStats();
  }

  /**
  * Adds the amount of coins given
  **/
  function addHunger(hunger){
    $statsScope.stats['hunger'] += hunger;
    if($statsScope.stats['hunger'] > 100) $statsScope.stats['hunger'] = 100;
    saveStats();
  }

  /**
  * Adds the amount of discipline given up to 100
  **/
  function addDiscipline(discipline){
    $statsScope.stats['discipline'] += discipline;
    if($statsScope.stats['discipline'] > 100) $statsScope.stats['discipline'] = 100;
    saveStats();
  }

  /**
  * Subtracts the amount of discipline given as low as 0 upon which pet runs away
  **/
  function subDiscipline(discipline){
    $statsScope.stats['discipline'] -= discipline;
    if($statsScope.stats['discipline'] <= 0) runAway();
    else saveStats();
  }

  /**
  * Syncs stats to chrome
  **/
  function saveStats(){
      storage['stats'] = $statsScope.stats;
      chrome.storage.sync.set(storage);
      $statsScope.$apply();
  }

  /**
  * The pet has run away. Displays this to the user and nothing else
  **/
  function runAway(){
    $statsScope.petRanAway = true;
    saveStats();
    $statsScope.$apply();
  }

  /**
  * Function to check if the discipline has gone below zero
  **/
  function checkForRunAway(){
    if($statsScope.stats['discipline'] <= 0){
      runAway();
    }
  }
})();
