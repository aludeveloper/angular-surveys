angular.module('mwFormViewer', ['ngSanitize', 'ui.bootstrap','ng-sortable', 'pascalprecht.translate']);



angular.module('mwFormViewer')
    .directive('mwPriorityList', function () {

    return {
        replace: true,
        restrict: 'AE',
        require: '^mwFormQuestion',
        scope: {
            question: '=',
            questionResponse: '=',
            readOnly: '=?',
            options: '=?'
        },
        templateUrl: 'mw-priority-list.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: function(){
            var ctrl = this;

            // Put initialization logic inside `$onInit()`
            // to make sure bindings have been initialized.
            this.$onInit = function() {
                if(!ctrl.questionResponse.priorityList){
                    ctrl.questionResponse.priorityList=[];
                }
                ctrl.idToItem = {};


                sortByPriority(ctrl.questionResponse.priorityList);

                ctrl.availableItems=[];
                ctrl.question.priorityList.forEach(function(item){
                    ctrl.idToItem[item.id] = item;
                    var ordered = ctrl.questionResponse.priorityList.some(function(ordered){
                        return item.id == ordered.id;
                    });
                    if(!ordered){
                        ctrl.availableItems.push({
                            priority: null,
                            id: item.id
                        });
                    }
                });

                ctrl.allItemsOrdered=ctrl.availableItems.length==0 ? true : null;

                var baseConfig = {
                    disabled: ctrl.readOnly,
                    ghostClass: "beingDragged"
//                tolerance: 'pointer',
//                items: 'div',
//                revert: 100

                };

                ctrl.orderedConfig = angular.extend({}, baseConfig, {
                    group:{
                        name: 'A',
                        pull: false,
                        put: ['B']
                    },
                    onEnd: function(e, ui) {
                        updatePriority(ctrl.questionResponse.priorityList);
                    }
                });

                ctrl.availableConfig = angular.extend({}, baseConfig, {
                    sort:false,
                    group:{
                        name: 'B',
                        pull: ['A'],
                        put: false
                    },
                    onEnd: function(e, ui) {
                        updatePriority(ctrl.questionResponse.priorityList);
                        ctrl.allItemsOrdered=ctrl.availableItems.length==0 ? true : null;
                    }
                });
            };

            function updatePriority(array) {
                if(array){
                    for(var i=0; i<array.length; i++){
                        var item = array[i];
                        item.priority = i+1;
                    }
                }

            }

            function sortByPriority(array) {
                array.sort(function (a, b) {
                    return a.priority - b.priority;
                });
            }

            // Prior to v1.5, we need to call `$onInit()` manually.
            // (Bindings will always be pre-assigned in these versions.)
            if (angular.version.major === 1 && angular.version.minor < 5) {
                this.$onInit();
            }

        },
        link: function (scope, ele, attrs, mwFormQuestion){
            var ctrl = scope.ctrl;
            ctrl.print =  mwFormQuestion.print;
        }
    };
});

angular.module('mwFormViewer').directive('mwFormViewer', ["$rootScope", function ($rootScope) {

    return {
        replace: true,
        restrict: 'AE',
        scope: {
            formData: '=',
            responseData: '=',
            templateData: '=?',
            readOnly: '=?',
            options: '=?',
            formStatus: '=?', //wrapper for internal angular form object
            onSubmit: '&',
            onSave: '&',
            onBack: '&',
            api: '=?'

        },
        templateUrl: 'mw-form-viewer.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: ["$timeout", "$interpolate", function($timeout, $interpolate){
            var ctrl = this;
            var rootScope = $rootScope;
            ctrl.largeFileFlag = false;
            ctrl.invalidPhone = false;
            $rootScope.$on("fileRequiredFlag", function(event, flag) {
                ctrl.largeFileFlag = flag;
            });

            // Put initialization logic inside `$onInit()`
            // to make sure bindings have been initialized.
            ctrl.$onInit = function() {
                ctrl.defaultOptions = {
                    nestedForm: false,
                    autoStart: false,
                    disableSubmit: false
                };
                ctrl.options = angular.extend({}, ctrl.defaultOptions, ctrl.options);

                ctrl.submitStatus='NOT_SUBMITTED';
                ctrl.formSubmitted=false;

                $rootScope.$on("invalidPhoneFlag", function(event, flag) {
                    ctrl.invalidPhone = flag;
                });

                sortPagesByNumber();
                ctrl.pageIdToPage={};
                ctrl.formData.pages.forEach(function(page){
                    ctrl.pageIdToPage[page.id]=page;
                });


                ctrl.buttons={
                    prevPage: {
                        visible: false,
                        disabled: false
                    },
                    nextPage: {
                        visible: false,
                        disabled: false
                    },
                    submitForm: {
                        visible: false,
                        disabled: false
                    }
                };
                rootScope.submitButton = ctrl.buttons.submitForm.visible;
                rootScope.formValid = ctrl.form;
                ctrl.resetPages();

                if(ctrl.api){
                    ctrl.api.reset = function(){
                        for (var prop in ctrl.responseData) {
                            if (ctrl.responseData.hasOwnProperty(prop)) {
                                delete ctrl.responseData[prop];
                            }
                        }

                        ctrl.buttons.submitForm.visible=false;
                        rootScope.submitButton = ctrl.buttons.submitForm.visible;
                        rootScope.formValid = ctrl.form;
                        ctrl.buttons.prevPage.visible=false;
                        ctrl.buttons.nextPage.visible=false;
                        ctrl.currentPage=null;
                        $timeout(ctrl.resetPages, 0);

                    }
                }
            };

            ctrl.submitForm = function() {
                ctrl.formSubmitted=true;
                ctrl.submitStatus='IN_PROGRESS';

                ctrl.setCurrentPage(null);


                var resultPromise = ctrl.onSubmit();
                resultPromise.then(function(){
                    ctrl.submitStatus='SUCCESS';
                }).catch(function(){
                    ctrl.submitStatus='ERROR';
                });

            };

            ctrl.submitValid = function() {
                if( ctrl.options.disableSubmit || ctrl.form.$invalid || ctrl.largeFileFlag || ctrl.invalidPhone) {
                    localStorage.setItem('submitValid', true);
                    return true;
                }else {
                    localStorage.setItem('submitValid', false);
                    return false;
                } 

            };

            ctrl.setCurrentPage = function (page) {
                ctrl.currentPage = page;
                if(!page){

                    ctrl.buttons.submitForm.visible=false;

                    $rootScope.submitButton = ctrl.buttons.submitForm.visible;

                    $rootScope.formValid = ctrl.form;

                    ctrl.buttons.prevPage.visible=false;

                    ctrl.buttons.nextPage.visible=false;
                    return;
                }

                ctrl.setDefaultNextPage();

                ctrl.initResponsesForCurrentPage();


            };


            ctrl.setDefaultNextPage  = function(){
                var index = ctrl.formData.pages.indexOf(ctrl.currentPage);
                ctrl.currentPage.isFirst = index==0;
                ctrl.currentPage.isLast = index==ctrl.formData.pages.length-1;

                ctrl.buttons.submitForm.visible=ctrl.currentPage.isLast;
                $rootScope.submitButton = ctrl.buttons.submitForm.visible;
                $rootScope.formValid = ctrl.form;
                ctrl.buttons.prevPage.visible=!ctrl.currentPage.isFirst;

                ctrl.buttons.nextPage.visible=!ctrl.currentPage.isLast;
                if(ctrl.currentPage.isLast){
                    ctrl.nextPage=null;
                }else{
                    ctrl.nextPage=ctrl.formData.pages[index+1];
                }

                if(ctrl.currentPage.pageFlow){
                    var formSubmit = false;
                    if(ctrl.currentPage.pageFlow.formSubmit){
                        ctrl.nextPage=null;
                        formSubmit = true;
                    }else if(ctrl.currentPage.pageFlow.page){
                        ctrl.nextPage=ctrl.pageIdToPage[ctrl.currentPage.pageFlow.page.id];
                        ctrl.buttons.nextPage.visible=true;
                    }else if(ctrl.currentPage.isLast){
                        ctrl.nextPage=null;
                        formSubmit = true;
                    }
                    ctrl.buttons.submitForm.visible=formSubmit;
                    $rootScope.submitButton = ctrl.buttons.submitForm.visible;
                    $rootScope.formValid = ctrl.form;
                    ctrl.buttons.nextPage.visible=!formSubmit;
                }
            };

            ctrl.initResponsesForCurrentPage = function(){
                ctrl.currentPage.elements.forEach(function(element){
                    var question = element.question;
                    if(question && !ctrl.responseData[question.id]){
                        ctrl.responseData[question.id]={};
                    }
                });
            };

            ctrl.beginResponse=function(){

                if(ctrl.formData.pages.length>0){
                    ctrl.setCurrentPage(ctrl.formData.pages[0]);
                    $rootScope.$broadcast("mwForm.pageEvents.pageCurrentChanged",{currentPage:ctrl.currentPage});
                }
            };
            
            ctrl.resetPages = function(){
                ctrl.prevPages=[];

                ctrl.currentPage=null;
                ctrl.nextPage = null;
                ctrl.formSubmitted=false;
                if(ctrl.options.autoStart){
                    ctrl.beginResponse();
                }

            };


            ctrl.goToPrevPage= function(){
                window.scrollTo(0,0);
                ctrl.onBack();
                var prevPage = ctrl.prevPages.pop();
                ctrl.setCurrentPage(prevPage);
                ctrl.updateNextPageBasedOnAllAnswers();
                $rootScope.$broadcast("mwForm.pageEvents.pageCurrentChanged",{currentPage:ctrl.currentPage});
            };

            ctrl.goToNextPage= function(){
                window.scrollTo(0,0);
                //TODO Saving each page data on next button 
                ctrl.onSave();
                
                ctrl.prevPages.push(ctrl.currentPage);

                ctrl.updateNextPageBasedOnAllAnswers();

                ctrl.setCurrentPage(ctrl.nextPage);
                $rootScope.$broadcast("mwForm.pageEvents.pageCurrentChanged",{currentPage:ctrl.currentPage});
            };

            ctrl.updateNextPageBasedOnAllAnswers = function(){
                ctrl.currentPage.elements.forEach(function(element){
                    ctrl.updateNextPageBasedOnPageElementAnswers(element);
                });

                ctrl.buttons.submitForm.visible=!ctrl.nextPage;
                $rootScope.submitButton = ctrl.buttons.submitForm.visible;
                $rootScope.formValid = ctrl.form;
                ctrl.buttons.nextPage.visible=!!ctrl.nextPage;
            };

            ctrl.updateNextPageBasedOnPageElementAnswers = function (element) {
                var question = element.question;
                if (question && question.pageFlowModifier) {
                    question.offeredAnswers.forEach(function (answer) {
                        if (answer.pageFlow) {
                            if(ctrl.responseData[question.id].selectedAnswer == answer.id){
                                if (answer.pageFlow.formSubmit) {
                                    ctrl.nextPage = null;
                                } else if (answer.pageFlow.page) {
                                    ctrl.nextPage = ctrl.pageIdToPage[answer.pageFlow.page.id];
                                }
                            }
                        }
                    });
                }
            };

            ctrl.onResponseChanged = function(pageElement){
                ctrl.setDefaultNextPage();
                $rootScope.$broadcast("mwForm.pageEvents.formSubmitValid",{ formSubmitValid: ctrl.form});
                ctrl.updateNextPageBasedOnAllAnswers();
            };

            function sortPagesByNumber() {
                ctrl.formData.pages.sort(function(a,b){
                    return a.number - b.number;
                });
            }

            ctrl.print=function(input){
                if (input&&ctrl.templateData){
                    return $interpolate(input)(ctrl.templateData);
                }
                return input;
            };

            // Prior to v1.5, we need to call `$onInit()` manually.
            // (Bindings will always be pre-assigned in these versions.)
            if (angular.version.major === 1 && angular.version.minor < 5) {
                ctrl.$onInit();
            }

        }],
        link: function (scope, ele, attrs){
            var ctrl = scope.ctrl;
            if(ctrl.formStatus){
                ctrl.formStatus.form = ctrl.form;
            }
            
            scope.$on('mwForm.pageEvents.changePage', function(event,data){
                if(typeof data.page !== "undefined" && data.page < ctrl.formData.pages.length){
                   ctrl.resetPages();
                   for(var i =0; i < data.page;i++){
                        ctrl.prevPages.push(ctrl.formData.pages[i]);
                   } 
                   var currenPge=ctrl.formData.pages[data.page];
                   ctrl.setCurrentPage(currenPge);
                   $rootScope.$broadcast("mwForm.pageEvents.pageCurrentChanged",{currentPage:currenPge});
                   ctrl.updateNextPageBasedOnAllAnswers();
                }
            });


        }
    };
}]);

angular.module('mwFormViewer').factory("FormQuestionId", function() {
        var id = 0;
        return {
            next: function() {
                return ++id;
            }
        }
    });

    angular.module('mwFormViewer').directive('mwFormQuestion', ['$parse','$rootScope', function($parse, $rootScope) {

        return {
            replace: true,
            restrict: 'AE',
            require: '^mwFormViewer',
            scope: {
                question: '=',
                questionResponse: '=',
                readOnly: '=?',
                options: '=?',
            onResponseChanged: '&?'
            },
            templateUrl: 'mw-form-question.html',
            controllerAs: 'ctrl',
            bindToController: true,
            controller: ["$timeout", "FormQuestionId", function($timeout, FormQuestionId) {
                var ctrl = this;
                ctrl.largeFileFlag = false;
                ctrl.fileSelectedEvent = false;
                ctrl.invalidPhone = false;
                ctrl.today = new Date();
                // Put initialization logic inside `$onInit()`
                // to make sure bindings have been initialized.
                this.$onInit = function() {
                    ctrl.id = FormQuestionId.next();

                    if (ctrl.question.type == 'radio') {
                        /*if (!ctrl.questionResponse.selectedAnswer) {
                            ctrl.questionResponse.selectedAnswer = null;
                        }*/
                        if (ctrl.questionResponse.other) {
                            ctrl.isOtherAnswer = true;
                        }

                    } else if (ctrl.question.type == 'checkbox') {
                        if (ctrl.questionResponse.selectedAnswers && ctrl.questionResponse.selectedAnswers.length) {
                            ctrl.selectedAnswer = true;
                        } else {
                            ctrl.questionResponse.selectedAnswers = [];
                        }
                        if (ctrl.questionResponse.other) {
                            ctrl.isOtherAnswer = true;
                        }


                    } else if (ctrl.question.type == 'grid') {
                        if (!ctrl.question.grid.cellInputType) {
                            ctrl.question.grid.cellInputType = "radio";
                        }
                        //if(ctrl.questionResponse.selectedAnswers){
                        //
                        //}else{
                        //    ctrl.questionResponse.selectedAnswers={};
                        //}
                    } else if (ctrl.question.type == 'division') {

                        ctrl.computeDivisionSum = function() {
                            ctrl.divisionSum = 0;
                            ctrl.question.divisionList.forEach(function(item) {

                                if (ctrl.questionResponse[item.id] != 0 && !ctrl.questionResponse[item.id]) {
                                    ctrl.questionResponse[item.id] = null;
                                    ctrl.divisionSum += 0;
                                } else {
                                    ctrl.divisionSum += ctrl.questionResponse[item.id];
                                }
                            });
                        };

                        ctrl.computeDivisionSum();


                    } else if (ctrl.question.type == 'date' || ctrl.question.type == 'datetime' || ctrl.question.type == 'time') {
                        if (ctrl.questionResponse.answer) {
                            ctrl.questionResponse.answer = new Date(ctrl.questionResponse.answer)
                        }
                    } else if (ctrl.question.type == 'file') {
                        ctrl.questionResponse.fileName = ctrl.questionResponse.fileName_1;
                        ctrl.questionResponse.answer = ctrl.questionResponse.answer;
                    }

                    ctrl.isAnswerSelected = false;
                    ctrl.initialized = true;
                };


                ctrl.mappingTelephoneQuestion = function(qdata) {
                    $timeout(function() {
                        if(qdata.type == "telephone"){
                            var telDynamicId = '#'+ qdata.id + 'phone';
                            var telDynamicError = '#'+ qdata.id + 'error-msg';
                            var telDynamicValid = '#'+ qdata.id + 'valid-msg';
                            var telInput = $(telDynamicId),
                              errorMsg = $(telDynamicError),
                              validMsg = $(telDynamicValid);

                              console.log(telInput);
                            // initialise plugin
                            
                            telInput.intlTelInput({
                              utilsScript: "../bower_components/intl-tel-input/build/js/utils.js"
                            });

                            var reset = function() {
                              telInput.removeClass("error");
                              errorMsg.addClass("hide");
                              validMsg.addClass("hide");
                            };

                            // on blur: validate
                            telInput.blur(function() {
                              reset();
                              if ($.trim(telInput.val())) {
                                if (telInput.intlTelInput("isValidNumber")) {
                                    ctrl.invalidPhone = false;
                                    $rootScope.$broadcast('invalidPhoneFlag', ctrl.invalidPhone);
                                  validMsg.removeClass("hide");
                                } else {
                                    ctrl.invalidPhone = true;
                                    $rootScope.$broadcast('invalidPhoneFlag', ctrl.invalidPhone);
                                  telInput.addClass("error");
                                  errorMsg.removeClass("hide");
                                }
                              }
                            });

                            // on keyup / change flag: reset
                            telInput.on("keyup change", reset);
                        }

                    }, 3000);
                }

                ctrl.initQuestionsView = function(qdata) {
                    console.log("welcome to the initQuestionsView");
                    //ctrl.hideRadioLinkedQuestions(qdata);
                    
                    ctrl.mappingTelephoneQuestion(qdata);
                };

                $timeout(function() {
                    $("#phone").on("countrychange", function(e, countryData) {
                        console.log(countryData);
                        ctrl.questionResponse.countryCode = countryData.dialCode;
                    });
                }, 500);


                ctrl.textareaChanged = function(){
                    delete ctrl.questionResponse.other;
                    ctrl.isOtherAnswer = false;
                    ctrl.answerChanged();
                };


                ctrl.selectedAnswerChanged = function() {
                    delete ctrl.questionResponse.other;
                    ctrl.isOtherAnswer = false;
                    ctrl.answerChanged();

                };
                ctrl.otherAnswerRadioChanged = function() {
                    if (ctrl.isOtherAnswer) {
                        ctrl.questionResponse.selectedAnswer = null;
                    }
                    ctrl.answerChanged();
                };

                ctrl.otherAnswerCheckboxChanged = function() {
                    if (!ctrl.isOtherAnswer) {
                        delete ctrl.questionResponse.other;
                    }
                    ctrl.selectedAnswer = ctrl.questionResponse.selectedAnswers.length || ctrl.isOtherAnswer ? true : null;
                    ctrl.answerChanged();
                };


                ctrl.toggleSelectedAnswer = function(answer) {
                    if (ctrl.questionResponse.selectedAnswers.indexOf(answer.id) === -1) {
                        ctrl.questionResponse.selectedAnswers.push(answer.id);
                    } else {
                        ctrl.questionResponse.selectedAnswers.splice(ctrl.questionResponse.selectedAnswers.indexOf(answer.id), 1);
                    }
                    ctrl.selectedAnswer = ctrl.questionResponse.selectedAnswers.length || ctrl.isOtherAnswer ? true : null;

                    ctrl.answerChanged();
                };

                ctrl.answerChanged = function() {
                    if (ctrl.onResponseChanged) {
                        ctrl.onResponseChanged();
                    }
                }

                // Prior to v1.5, we need to call `$onInit()` manually.
                // (Bindings will always be pre-assigned in these versions.)
                if (angular.version.major === 1 && angular.version.minor < 5) {
                    this.$onInit();
                }

            }],
            link: function(scope, ele, attrs, mwFormViewer) {
                var ctrl = scope.ctrl;
                ctrl.print = mwFormViewer.print;

                //file uploads

                ele.bind("change", function(changeEvent) {
                    var fileSize = changeEvent.target.files[0].size / 4096;
                    console.log("file size.....................",fileSize);
                    if (fileSize <= 1024) {
                        ctrl.fileSelectedEvent = true;
                        ctrl.largeFileFlag = false;
                        $rootScope.$broadcast('fileRequiredFlag', ctrl.largeFileFlag);
                        var reader = new FileReader();
                        var fileName = changeEvent.target.files[0];
                        reader.onload = function(loadEvent) {
                            scope.$apply(function() {
                                ctrl.questionResponse.answer = loadEvent.target.result;
                                ctrl.questionResponse.fileName = changeEvent.target.files[0].name;
                            });
                        }
                        
                        reader.readAsDataURL(changeEvent.target.files[0]); 
                    } else {
                        ctrl.largeFileFlag = true; 
                        $rootScope.$broadcast('fileRequiredFlag', ctrl.largeFileFlag);
                        alert("File size is large; maximum file size 4 MB");           
                    }
                });
            }
        };
    }]);

angular.module('mwFormViewer')
    .directive('mwFormConfirmationPage', function () {

    return {
        replace: true,
        restrict: 'AE',
        require: '^mwFormViewer',
        scope: {
            submitStatus: '=',
            confirmationMessage: '=',
            readOnly: '=?'
        },
        templateUrl: 'mw-form-confirmation-page.html',
        controllerAs: 'ctrl',
        bindToController: true,
        controller: function(){
            var ctrl = this;


        },
        link: function (scope, ele, attrs, mwFormViewer){
            var ctrl = scope.ctrl;
            ctrl.print =  mwFormViewer.print;
        }
    };
});
