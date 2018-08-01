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