import events from './../../../../bl/events.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statMainController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {
            $scope.currentTab = 'catalog';

            $scope.model = {
                title: 'Статистика сообщества',
                groupAddress: '',
                datePicker: {
                    dateFrom: '',
                    dateTo: '',
                    popupFrom: {
                        opened: false
                    },
                    popupTo: {
                        opened: false
                    }
                }
            };

            $scope.stat = {
                photos: {},
                videos: {},
                groupInfo: {}
            };

            $scope.error = {};
            $scope.statIsLoaded = false;
            $scope.isHiddenMenu = true;
            $scope.statNotAccess = false;
            $scope.groupIsFinded = false;
            $scope.progressPercent = 0.0;
            $scope.progressPercentSubscribers = 0.0;
            $scope.percentItem = (100 / 6).toFixed(2);
            $scope.adminGroups = [];
            $scope.activeTab = 'dynamic';
            $scope.hiddenFilter = false;

            $scope.getStat = getStat;
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.setGroupLink = setGroupLink;
            $scope.nextProgressStep = nextProgressStep;
            $scope.showTab = showTab;
            $scope.getStatExample = getStatExample;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            $scope.$watch('model.datePicker.dateFrom', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.error.datePickerFromError = "";
            });

            $scope.$watch('model.datePicker.dateTo', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.error.datePickerToError = "";
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var graphModel = {};

            var needGetStatFromParams = $stateParams.getStatFromGroup ? $stateParams.getStatFromGroup : false;

            function defaultGraph() {
                var startRender = false,
                    currgraph,
                    chart;
                var showGraph = function (data) {
                    currgraph = data;
                    renderGraph(data);
                    initHandlers();
                };
                var renderGraph = function (data) {
                    if (chart)
                        chart.destroy();

                    var config = graphConfig(data);
                    var ctx = document.getElementById(currgraph.element) ? document.getElementById(currgraph.element).getContext("2d") : false;
                    if (!ctx) {

                        return;
                    }
                    ctx.clearRect(0, 0, document.getElementById(currgraph.element).width, document.getElementById(currgraph.element).height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#" + currgraph.element).parent().width();

                    chart = new Chart(ctx, config);

                    startRender = false;
                };
                var initHandlers = function () {
                    $(window).resize(function () {
                        if (startRender)
                            return;

                        startRender = true;
                        setTimeout(function () {
                            renderGraph(currgraph);
                        }, 200);
                    });
                    bus.subscribe(events.STAT.MAIN.RESIZE_GRAPH, ()=> {
                        setTimeout(function () {
                            renderGraph(currgraph);
                        }, 0);
                    });
                };
                var graphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: currgraph.labels,
                            datasets: currgraph.datasets
                        },
                        options: {
                            responsive: false,
                            title: {
                                display: true,
                                text: ''
                            },
                            tooltips: {
                                mode: 'label',
                            },
                            hover: {
                                mode: 'dataset'
                            },
                            scales: {
                                xAxes: [{
                                    display: true,
                                    scaleLabel: {
                                        show: true,
                                        labelString: 'Дата'
                                    }
                                }],
                                yAxes: [{
                                    display: true,
                                    scaleLabel: {
                                        show: true,
                                        labelString: 'Значение'
                                    }
                                }]
                            },
                            legend: {
                                display: false,
                                labelspadding: 0
                            }
                        }
                    }
                };

                this.showGraph = showGraph;
                this.destroy = ()=> {
                    if (chart) {
                        chart.destroy();
                    }
                };
                this.getChart = ()=> {
                    return chart;
                }
            }

            $scope.$watch('model.groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.urlError = "";
            });

            function getMemoryData() {
                var lastData = memoryFactory.getMemory('mainStat');
                if (lastData) {
                    $scope.stat = lastData;
                    $scope.model.groupAddress = lastData.groupAddress;

                    $timeout(()=> {
                        /*if (lastData.graph.graphPeopleStatData)
                         peopleStatGraph.showGraph(lastData.graph.graphPeopleStatData);

                         if (lastData.graph.subscribersStatData)
                         subscribersStatGraph.showGraph(lastData.graph.subscribersStatData);

                         if (lastData.graph.attendanceStatData)
                         attendanceStatGraph.showGraph(lastData.graph.attendanceStatData);*/

                        //Установка периода todo доделать
                        /*$.each('input[name=checkDate]')(()=> {
                         $(this).prop("checked", false);
                         });
                         var radios = $('input[name=checkDate]');
                         radios.filter('[value="' + lastData.periodValue + '"]')[0].prop("checked", true);*/
                    });

                    $scope.statIsLoaded = true;
                }
            }

            function getCheckedDate() {
                var checkDate = $('input[name=checkDate]:checked').val();
                var currDate = new Date();
                var dateTo = new Date();
                var dateFrom;

                switch (checkDate) {
                    case "week":
                        dateFrom = currDate.setDate(currDate.getDate() - 6);
                        break;
                    case "twoWeek":
                        dateFrom = currDate.setDate(currDate.getDate() - 13);
                        break;
                    case "month":
                        dateFrom = currDate.setDate(currDate.getDate() - 29);
                        break;
                    case "datePicker":
                        if (!$scope.model.datePicker.dateFrom){
                            $scope.error.datePickerFromError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if (!$scope.model.datePicker.dateTo){
                            $scope.error.datePickerToError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom > $scope.model.datePicker.dateTo){
                            $scope.error.datePickerFromError = "Дата начала превышает дату окончания";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom.getTime() == $scope.model.datePicker.dateTo.getTime()){
                            $scope.model.datePicker.dateTo = new Date($scope.model.datePicker.dateTo.getTime() + 24*60*60*1000);
                        }

                        dateFrom = $scope.model.datePicker.dateFrom;
                        dateTo = $scope.model.datePicker.dateTo;

                        break;
                }

                return {
                    from: moment(dateFrom).format("YYYY-MM-DD"),
                    fromLabel: moment(dateFrom).format("DD.MM.YYYY"),
                    to: moment(dateTo).format("YYYY-MM-DD"),
                    toLabel: moment(dateTo).format("DD.MM.YYYY"),
                    unixFrom: dateFrom / 1000,
                    unixTo: dateTo / 1000
                };
            }

            function getStat(isExample) {
                if (!appState.isActiveUser() && !isExample) {
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    return;
                }

                if (!$scope.model.groupAddress) {
                    $scope.urlError = 'Укажите адрес или символьный код группы';
                    return;
                }

                $scope.groupIsFinded = false;
                $scope.progressPercent = 0.0;
                $scope.isLoading = true;
                $scope.activeTab = 'activity';

                var parseDate = getCheckedDate();
                if (!parseDate || (parseDate && parseDate.error)) {
                    return;
                }

                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);
                var vkGid;
                var groupInfo;
                var ER = parseFloat(0);

                $scope.stat.groupAddress = $scope.model.groupAddress;
                $scope.stat.periodValue = $('input[name=checkDate]:checked').val();
                $scope.stat.periodLabels = {
                    from: parseDate.fromLabel,
                    to: parseDate.toLabel
                };
                $scope.stat.groupInfo.wallAnalysisCount = 0;
                $scope.stat.groupInfo.ER = 0;
                $scope.stat.groupInfo.ERMax = 0;
                $scope.hiddenFilter = true;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {

                    if (res && res.error && res.error.error_code == 100) {
                        $scope.$apply(function () {
                            $scope.urlError = 'Введеная группа вконтакте не найдена';
                            $scope.isLoading = false;
                            $scope.statIsLoaded = false;
                            $scope.hiddenFilter = false;
                        });
                        return;
                    }

                    if (res && res.error && res.error.error_code == 6) {
                        setTimeout(()=> {
                            console.log("recursive!");
                            getStat(isExample);
                        }, 1500);
                        return;
                    }

                    $scope.$apply(function () {
                        $scope.statIsLoaded = true;
                        $scope.groupIsFinded = true;
                        $scope.stat.membersCount = res.members_count;
                        $scope.stat.groupCounters = {
                            albums: res.counters && res.counters.albums ? res.counters.albums : 0,
                            docs: res.counters && res.counters.docs ? res.counters.docs : 0,
                            photos: res.counters && res.counters.photos ? res.counters.photos : 0,
                            topics: res.counters && res.counters.topics ? res.counters.topics : 0,
                            videos: res.counters && res.counters.videos ? res.counters.videos : 0
                        };
                        $scope.stat.groupName = res.name;
                        $scope.stat.groupImage = res.photo_big || res.photo_medium || res.photo;
                        $scope.stat.description = res.description;
                        $scope.stat.screen_name = res.screen_name;
                        vkGid = res.gid;
                    });
                    groupInfo = res;

                    $.when(
                        getPeopleStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        getWallStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                            $scope.stat.groupInfo.ER = (ER / $scope.stat.groupInfo.wallAnalysisCount).toFixed(3);
                            var ERdayCount = 0;
                            $scope.stat.wall.activityData.forEach((item)=>{
                                ERdayCount = parseFloat(parseFloat(ERdayCount) + parseFloat(item.postER)).toFixed(3);
                            });
                            $scope.stat.groupInfo.ERday = (ERdayCount/$scope.stat.wall.activityData.length).toFixed(3);
                        }),
                        getAlbumsStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        getPhotoStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        getPhotoCommentsStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        getVideoStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        })
                    )
                        .then(function () {
                            //Рисуем графики
                            renderAllGraphs();

                            bus.publish(events.STAT.MAIN.FINISHED, $scope.stat);
                            memoryFactory.setMemory('mainStat', $scope.stat);
                        })
                        .always(()=> {
                            $timeout(()=> {
                                $scope.progressPercent = 100;
                                $(".nano").nanoScroller();
                                $scope.isLoading = false;
                            });
                        });
                });

                //Получение статистики по численности
                function getPeopleStat() {
                    var deferr = $.Deferred();

                    getPeopleStatRequest();

                    function getPeopleStatRequest() {
                        vkApiFactory.getStat(authData, {
                            groupId: vkGid,
                            dateFrom: parseDate.from,
                            dateTo: parseDate.to
                        }).then(function (res) {
                            var stat = {
                                views: 0,
                                visitors: 0,
                                subscribed: 0,
                                unsubscribed: 0,
                                subscribedSumm: 0,
                                reach: 0,
                                reachSubscribers: 0
                            };
                            var graphPeopleStatData = {
                                labels: [],
                                subscribedDataSet: [],
                                unsubscribedDataSet: []
                            };
                            var subscribersStatData = {
                                labels: [],
                                membersCount: []
                            };
                            var attendanceStatData = {
                                labels: [],
                                viewsData: [],
                                visitorsData: []
                            };
                            var currMembersCount = groupInfo.members_count;
                            if (res && !res.error) {
                                $scope.statNotAccess = false;
                                res.forEach(function (dateStat, i) {
                                    stat.views += dateStat.views ? dateStat.views : 0;
                                    stat.visitors += dateStat.visitors ? dateStat.visitors : 0;
                                    stat.subscribed += dateStat.subscribed ? dateStat.subscribed : 0;
                                    stat.unsubscribed += dateStat.unsubscribed ? dateStat.unsubscribed : 0;
                                    stat.reach += dateStat.reach ? dateStat.reach : 0;
                                    stat.reachSubscribers += dateStat.reach_subscribers ? dateStat.reach_subscribers : 0;
                                    //Сбор данных для графика участников
                                    graphPeopleStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    graphPeopleStatData.subscribedDataSet.unshift(dateStat.subscribed || 0);
                                    graphPeopleStatData.unsubscribedDataSet.unshift(dateStat.unsubscribed || 0);
                                    //График посещаемости/просмотров группы
                                    attendanceStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    attendanceStatData.viewsData.unshift(dateStat.views || 0);
                                    attendanceStatData.visitorsData.unshift(dateStat.visitors || 0);

                                    subscribersStatData.labels.unshift(getDateFromVk(dateStat.day));
                                    if (i != 0)
                                        currMembersCount -= (dateStat.subscribed - dateStat.unsubscribed);

                                    subscribersStatData.membersCount.unshift(currMembersCount);
                                });
                            }


                            if (res && res.error) {
                                switch (res.error.error_code) {
                                    case 7:
                                        //Статистика группы недоступна
                                        $scope.statNotAccess = true;
                                        break;
                                    case 6:
                                    {
                                        setTimeout(()=> {
                                            getPeopleStatRequest();
                                        }, 500);
                                        return deferr.promise();
                                    }
                                }

                            }

                            var summSubscribers = 0,
                                subscribersForStartPeriod;
                            graphPeopleStatData.subscribedDataSet.forEach(function (item) {
                                summSubscribers += item;
                            });
                            graphPeopleStatData.unsubscribedDataSet.forEach(function (item) {
                                summSubscribers -= item;
                            });

                            $scope.$apply(function () {
                                $scope.stat.views = stat.views;
                                $scope.stat.visitors = stat.visitors;
                                $scope.stat.subscribed = stat.subscribed;
                                $scope.stat.unsubscribed = stat.unsubscribed;
                                $scope.stat.subscribedSumm = stat.subscribed - stat.unsubscribed;
                                $scope.stat.reachSubscribers = stat.reachSubscribers;
                                $scope.stat.reach = stat.reach;
                                $scope.stat.graph = {
                                    graphPeopleStatData: graphPeopleStatData,
                                    subscribersStatData: subscribersStatData,
                                    attendanceStatData: attendanceStatData
                                };
                            });

                            deferr.resolve();

                            function getDateFromVk(dateVk) {
                                var normilizedDate = new Date(dateVk);
                                return ('0' + normilizedDate.getDate()).slice(-2) + "." + ('0' + (normilizedDate.getMonth() + 1)).slice(-2);
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }

                //Получение статистик по стене группы
                function getWallStat() {
                    var deferr = $.Deferred();
                    var iteration = 0;
                    var wallStat = {
                        activity: {
                            likesPeriodCount: 0,
                            repostsPeriodCount: 0,
                            commentsPeriodCount: 0
                        },
                        counters: {
                            wallPostsPeriodCount: 0
                        },
                        statGraph: []
                    };

                    getWall();

                    function calcER(post) {
                        if ($scope.stat.membersCount && post.likes && post.reposts && post.comments) {
                            var postER = (post.likes.count + post.reposts.count + post.comments.count) / $scope.stat.membersCount * 100;
                            postER = postER.toFixed(3);

                            return postER;
                        }

                        return (0).toFixed(3);
                    }

                    function getWall() {
                        if (iteration >= 130) {
                            deferr.resolve();
                            return;
                        }

                        vkApiFactory.getWall(authData, {
                            groupId: vkGid,
                            offset: iteration * 100,
                            count: 100
                        }).then(function (res) {
                            var flagStop = false;
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getWall();
                                }, 400);
                                return;
                            }

                            if (res && res.length > 1) {
                                wallStat.counters.allWallPostsCount = res[0];//Количество постов за период
                                res.forEach(function (post) {
                                    if (post.date > parseDate.unixFrom && post.date < parseDate.unixTo) {
                                        wallStat.counters.wallPostsPeriodCount++;//Количество постов за период
                                        wallStat.activity.likesPeriodCount += post.likes.count || 0;
                                        wallStat.activity.repostsPeriodCount += post.reposts.count || 0;
                                        wallStat.activity.commentsPeriodCount += post.comments.count || 0;

                                        var date = new Date(post.date * 1000);
                                        var postDate = date.getDate() + "." + (date.getMonth() + 1) + "." + date.getFullYear();
                                        var postER = calcER(post);
                                        ER += parseFloat(postER);
                                        $scope.stat.groupInfo.wallAnalysisCount += 1;

                                        if ($scope.stat.groupInfo.ERMax < postER) {
                                            $scope.stat.groupInfo.ERMax = postER;
                                        }


                                        if (!wallStat.statGraph.length || (wallStat.statGraph[wallStat.statGraph.length - 1] && wallStat.statGraph[wallStat.statGraph.length - 1].date != postDate)) {
                                            wallStat.statGraph.push({
                                                likes: post.likes.count || 0,
                                                reposts: post.reposts.count || 0,
                                                comments: post.comments.count || 0,
                                                summActions: (post.likes.count || 0) + (post.reposts.count || 0) + (post.comments.count || 0),
                                                postER: postER,
                                                date: postDate,
                                                datetime: new Date(date.getFullYear(), date.getMonth(), date.getDate())
                                            });
                                        } else {
                                            wallStat.statGraph[wallStat.statGraph.length - 1].likes += post.likes.count || 0;
                                            wallStat.statGraph[wallStat.statGraph.length - 1].reposts += post.reposts.count || 0;
                                            wallStat.statGraph[wallStat.statGraph.length - 1].comments += post.comments.count || 0;
                                            wallStat.statGraph[wallStat.statGraph.length - 1].summActions += (post.likes.count || 0) + (post.reposts.count || 0) + (post.comments.count || 0);
                                            var t = wallStat.statGraph[wallStat.statGraph.length - 1].postER;
                                            wallStat.statGraph[wallStat.statGraph.length - 1].postER = (parseFloat(t) + parseFloat(postER)).toFixed(3);

                                        }


                                    } else if (post.date <= parseDate.unixFrom && !post.is_pinned) {
                                        flagStop = true;
                                    }
                                });

                                $scope.nextProgressStep(($scope.percentItem / wallStat.counters.allWallPostsCount) * (iteration * 100));
                            } else {
                                wallStat.counters.allWallPostsCount = 0;
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getWall();
                            } else {
                                /*console.log(wallStat);*/
                                wallStat.statGraph.sort((a, b)=> {
                                    if (new Date(a.datetime) > new Date(b.datetime))
                                        return 1;
                                    else return -1;
                                });

                                $scope.$apply(function () {
                                    $scope.stat.wall = {
                                        allPosts: wallStat.counters.allWallPostsCount,
                                        postsPeriod: wallStat.counters.wallPostsPeriodCount,
                                        likesPeriod: wallStat.activity.likesPeriodCount,
                                        repostsPeriod: wallStat.activity.repostsPeriodCount,
                                        commentsPeriod: wallStat.activity.commentsPeriodCount,
                                        activityData: wallStat.statGraph
                                    };
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }

                function getAlbumsStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 5,
                        iteration = 0,
                        newAlbums = 0;

                    getAlbums();

                    function getAlbums() {
                        if (iteration >= maxIterations) {
                            newAlbums = 0;
                            deferr.resolve();
                            return;
                        }
                        iteration++;
                        vkApiFactory.getAlbums(authData, {
                            groupId: "-" + vkGid
                        }).then(function (res) {
                            if (!res || res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getAlbums();
                                }, 400);
                                return;
                            } else {
                                if (res.error && res.error.error_code == 15) {
                                    deferr.resolve();
                                }
                            }
                            if (res && res.length > 0) {
                                res.forEach(function (item) {
                                    if (item.created > parseDate.unixFrom && item.created < parseDate.unixTo) {
                                        newAlbums++;
                                    }
                                });
                                $scope.$apply(function () {
                                    $scope.stat.albums = {
                                        albumsPeriod: newAlbums
                                    };
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }

                function getPhotoStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        photosStat = {
                            allCount: 0,
                            photoPeriodCount: 0,
                            repostsPeriodCount: 0,
                            likesPeriodCount: 0
                        },
                        flagStop = false;

                    getPhotos();

                    function getPhotos() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            deferr.resolve();
                            return;
                        }
                        vkApiFactory.getAllPhoto(authData, {
                            groupId: "-" + vkGid,
                            count: 200,
                            offset: iteration * 200,
                            extended: 1
                        }).then(function (res) {
                            /*console.log(res);*/
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getPhotos();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                photosStat.allCount = res[0];//Количество постов за период
                                if (res.length <= photosStat.allCount || photosStat.allCount == 0) {
                                    flagStop = true;
                                }

                                res.forEach(function (photo) {
                                    if (photo.created > parseDate.unixFrom && photo.created < parseDate.unixTo) {
                                        photosStat.photoPeriodCount++;//Количество фото за период
                                        photosStat.likesPeriodCount += photo.likes.count || 0;//Количество фото за период
                                        photosStat.repostsPeriodCount += photo.reposts.count || 0;
                                    } else if (photo.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getPhotos();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.photos.allCount = photosStat.allCount;
                                    $scope.stat.photos.likesPeriodCount = photosStat.likesPeriodCount;
                                    $scope.stat.photos.repostsPeriodCount = photosStat.repostsPeriodCount;
                                    $scope.stat.photos.photoPeriodCount = photosStat.photoPeriodCount;
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }

                    return deferr.promise();
                }

                function getPhotoCommentsStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        photosStat = {
                            commentsPeriodCount: 0
                        },
                        flagStop = false;

                    getPhotosComments();

                    function getPhotosComments() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            deferr.resolve();
                            return;
                        }
                        vkApiFactory.getAllCommentsPhoto(authData, {
                            groupId: "-" + vkGid,
                            count: 100,
                            offset: iteration * 100
                        }).then(function (res) {
                            /*console.log(res);*/
                            if (res && res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getPhotosComments();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                res.forEach(function (comment) {
                                    if (comment.date > parseDate.unixFrom && comment.date < parseDate.unixTo) {
                                        photosStat.commentsPeriodCount++;//Количество комментариев за период
                                    } else if (comment.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getPhotosComments();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.photos.commentsPeriodCount = photosStat.commentsPeriodCount
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }

                    return deferr.promise();
                }

                function getVideoStat() {
                    var deferr = $.Deferred();
                    var maxIterations = 30,
                        iteration = 0,
                        videoStat = {
                            allCount: 0,
                            videoPeriodCount: 0,
                            repostsPeriodCount: 0,
                            likesPeriodCount: 0
                        },
                        flagStop = false;

                    getVideo();

                    function getVideo() {
                        if (iteration >= maxIterations) {
                            //newAlbums = 0;
                            deferr.resolve();
                            return;
                        }
                        vkApiFactory.getVideos(authData, {
                            groupId: "-" + vkGid,
                            count: 200,
                            offset: iteration * 200,
                            extended: 1
                        }).then(function (res) {
                            /*console.log(res);*/
                            if (res && res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getVideo();
                                }, 400);
                                return;
                            }
                            if (res && res.length > 0) {
                                videoStat.allCount = res[0];//Количество постов за период
                                if (res.length <= videoStat.allCount || videoStat.allCount == 0) {
                                    flagStop = true;
                                }

                                res.forEach(function (video) {
                                    if (video.date > parseDate.unixFrom && video.date < parseDate.unixTo) {
                                        videoStat.photoPeriodCount++;//Количество фото за период
                                        videoStat.likesPeriodCount += video.likes.count || 0;//Количество фото за период
                                        videoStat.repostsPeriodCount += video.reposts && video.reposts.count ? video.reposts.count : 0;
                                    } else if (video.date <= parseDate.unixFrom) {
                                        flagStop = true;
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getVideo();
                            } else {
                                $scope.$apply(function () {
                                    $scope.stat.videos.allCount = videoStat.allCount;
                                    $scope.stat.videos.likesPeriodCount = videoStat.likesPeriodCount;
                                    $scope.stat.videos.repostsPeriodCount = videoStat.repostsPeriodCount;
                                    $scope.stat.videos.videoPeriodCount = videoStat.videoPeriodCount;
                                });
                                deferr.resolve();
                            }
                        }).fail(function () {
                            deferr.reject();
                        });

                    }

                    return deferr.promise();
                }

                /*function getGroupMembersStat() {
                 var deferr = $.Deferred();
                 var iteration = 0;
                 var model = {
                 deactivatedCount: 0,
                 lastSeenMonthCount: 0
                 };

                 getGroupMembersFunc();

                 return deferr.promise();

                 function getGroupMembersFunc(currIteration) {
                 currIteration = currIteration ? currIteration : 0;
                 vkApiFactory.execute.getGroupMembers(authData, {
                 groupId: vkGid,
                 offset: currIteration * 25000,
                 fields: "last_seen"
                 }).then((res)=> {

                 if (res && !res.error) {
                 res.forEach((arr)=> {
                 var deactivatedList = arr.users.filter((user)=> {
                 return user.deactivated != null;
                 });
                 var lastSeenList = arr.users.filter((user)=> {
                 return user.last_seen && user.last_seen.time && (user.last_seen.time > parseDate.unixFrom);
                 });
                 model.deactivatedCount += deactivatedList.length;
                 model.lastSeenMonthCount += lastSeenList.length;
                 });

                 if ((currIteration + 1) * 25000 < $scope.stat.membersCount) {

                 $scope.nextProgressStep($scope.percentItem / ($scope.stat.membersCount / 25000));
                 $scope.nextProgressStepSubscribers(100 / ($scope.stat.membersCount / 25000));
                 getGroupMembersFunc(currIteration + 1);
                 } else {
                 $scope.$apply(()=> {
                 $scope.stat.deactivatedCount = model.deactivatedCount;
                 $scope.stat.lastSeenMonthCount = model.lastSeenMonthCount;

                 deferr.resolve();
                 });
                 }
                 }

                 /!*console.log(model);
                 console.log(parseDate.unixFrom);*!/

                 }).fail(()=> {
                 deferr.reject();
                 notify.error("Не удалось выгрузить статистику по подписчикам группы");
                 });
                 }
                 }*/
            }

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function setGroupLink(group) {
                $scope.model.groupAddress = "https://vk.com/" + group.screen_name;
                $scope.isHiddenMenu = true;
            }

            function checkMainStatIsSaved() {
                var stat = appState.getMainStat();
                if (stat) {
                    $scope.stat = stat;
                }
            }

            function nextProgressStep(step) {
                if (step == 0 || !step) {
                    return;
                }

                var progressPercent = parseFloat($scope.progressPercent);
                progressPercent += parseFloat(step);
                progressPercent = progressPercent.toFixed(2);

                $timeout(()=> {
                    if (progressPercent < 100) {
                        $scope.progressPercent = progressPercent;
                    }
                });
            }

            function init() {
                checkMainStatIsSaved();
                getMemoryData();

                $('.icheck').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue'
                });

                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                });

                $(".nano").nanoScroller();

                if (needGetStatFromParams) {
                    $scope.model.groupAddress = needGetStatFromParams;
                    getStat();
                }
            }

            function showTab(tab) {
                bus.publish(events.STAT.MAIN.RESIZE_GRAPH);
                switch (tab) {
                    case 'activity':
                        $scope.activeTab = 'activity';
                        break;
                    case 'dynamic':
                        $scope.activeTab = 'dynamic';
                        break;
                    case 'er':
                        $scope.activeTab = 'er';
                        break;
                    case 'content':
                        $scope.activeTab = 'content';
                        break;
                }
            }

            function getStatExample(urlOrScreenName) {
                if ($scope.isLoading) {
                    notify.info("Дождитесь завершения получения статистики");
                    return;
                }
                $scope.model.groupAddress = urlOrScreenName;
                getStat(true);
            }

            function renderAllGraphs() {
                //График динамики реакций на контент
                if (graphModel.wallActivityGraph) {
                    graphModel.wallActivityGraph.destroy();
                }
                graphModel.wallActivityGraph = new defaultGraph();
                graphModel.wallActivityGraph.showGraph({
                    element: "wallActivityGraph",
                    labels: $scope.stat.wall.activityData.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Реакции на контент",
                        data: $scope.stat.wall.activityData.map((item)=> {
                            return item.summActions;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График лайков на стене
                if (graphModel.wallLikesGraph) {
                    graphModel.wallLikesGraph.destroy();
                }
                graphModel.wallLikesGraph = new defaultGraph();
                graphModel.wallLikesGraph.showGraph({
                    element: "wallLikesGraph",
                    labels: $scope.stat.wall.activityData.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Лайки на стене",
                        data: $scope.stat.wall.activityData.map((item)=> {
                            return item.likes;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });

                //График репостов со стены
                if (graphModel.wallRepostsGraph) {
                    graphModel.wallRepostsGraph.destroy();
                }
                graphModel.wallRepostsGraph = new defaultGraph();
                graphModel.wallRepostsGraph.showGraph({
                    element: "wallRepostsGraph",
                    labels: $scope.stat.wall.activityData.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Репосты со стены",
                        data: $scope.stat.wall.activityData.map((item)=> {
                            return item.reposts;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График комментариев на стене
                if (graphModel.wallCommentsGraph) {
                    graphModel.wallCommentsGraph.destroy();
                }
                graphModel.wallCommentsGraph = new defaultGraph();
                graphModel.wallCommentsGraph.showGraph({
                    element: "wallCommentsGraph",
                    labels: $scope.stat.wall.activityData.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Комментарии на стене",
                        data: $scope.stat.wall.activityData.map((item)=> {
                            return item.comments;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График динамики количества участников
                if (graphModel.subscribersStatGraph) {
                    graphModel.subscribersStatGraph.destroy();
                }
                graphModel.subscribersStatGraph = new defaultGraph();
                graphModel.subscribersStatGraph.showGraph({
                    element: "subscribersStatGraph",
                    labels: $scope.stat.graph.subscribersStatData.labels,
                    datasets: [{
                        label: "Количество пользователей",
                        data: $scope.stat.graph.subscribersStatData.membersCount,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
                //График количества вступивших и вышедших участников
                if (graphModel.peopleStatGraph) {
                    graphModel.peopleStatGraph.destroy();
                }
                graphModel.peopleStatGraph = new defaultGraph();
                graphModel.peopleStatGraph.showGraph({
                    element: "graphPeopleStat",
                    labels: $scope.stat.graph.graphPeopleStatData.labels,
                    datasets: [{
                        label: "Новых участников",
                        data: $scope.stat.graph.graphPeopleStatData.subscribedDataSet,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Вышедших участников",
                        data: $scope.stat.graph.graphPeopleStatData.unsubscribedDataSet,
                        fill: false,
                        borderColor: '#b05c91',
                        backgroundColor: '#b05c91'
                    }]
                });
                //График посещаемости и просмотров
                if (graphModel.attendanceStatGraph) {
                    graphModel.attendanceStatGraph.destroy();
                }
                graphModel.attendanceStatGraph = new defaultGraph();
                graphModel.attendanceStatGraph.showGraph({
                    element: "attendanceStatGraph",
                    labels: $scope.stat.graph.attendanceStatData.labels,
                    datasets: [{
                        label: "Просмотров",
                        data: $scope.stat.graph.attendanceStatData.viewsData,
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }, {
                        label: "Посещений",
                        data: $scope.stat.graph.attendanceStatData.visitorsData,
                        fill: false,
                        borderColor: '#b05c91',
                        backgroundColor: '#b05c91'
                    }]
                });
                //График динамики вовлеченности
                if (graphModel.wallERGraph) {
                    graphModel.wallERGraph.destroy();
                }
                graphModel.wallERGraph = new defaultGraph();
                graphModel.wallERGraph.showGraph({
                    element: "wallERGraph",
                    labels: $scope.stat.wall.activityData.map((item)=> {
                        return item.date;
                    }),
                    datasets: [{
                        label: "Суммарная вовлеченность за день",
                        data: $scope.stat.wall.activityData.map((item)=> {
                            return item.postER;
                        }),
                        fill: false,
                        borderColor: '#597da3',
                        backgroundColor: '#597da3',
                        pointBorderWidth: 2,
                        pointHoverRadius: 3
                    }]
                });
            }

            function openDatepickerPopupFrom() {
                $scope.model.datePicker.popupFrom.opened = !$scope.model.datePicker.popupFrom.opened;
            }

            function openDatepickerPopupTo() {
                $scope.model.datePicker.popupTo.opened = !$scope.model.datePicker.popupTo.opened;
            }

            init();


        }

    ])
;