import events from './../../../../bl/events.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statMainController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Общая статистика сообщества';

            $scope.getStat = getStat;
            $scope.model = {
                groupAddress: ''
            };
            $scope.stat = {
                photos: {},
                videos: {}
            };

            $scope.statIsLoaded = false;
            $scope.isHiddenMenu = true;
            $scope.statNotAccess = false;
            $scope.groupIsFinded = false;
            $scope.progressPercent = 0.0;
            $scope.progressPercentSubscribers = 0.0;
            $scope.percentItem = (100 / 6).toFixed(2);
            $scope.adminGroups = [];
            $scope.activeTab = 'dynamic';

            $scope.showGroupsMenu = showGroupsMenu;
            $scope.setGroupLink = setGroupLink;
            $scope.nextProgressStep = nextProgressStep;
            $scope.showTab = showTab;
            $scope.getStatExample = getStatExample;

            $scope.$watch('isLoading', (newVal)=>{
                $rootScope.globalLoading = newVal;
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var needGetStatFromParams = $stateParams.getStatFromGroup ? $stateParams.getStatFromGroup : false;

            var peopleStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("graphPeopleStat") ? document.getElementById("graphPeopleStat").getContext("2d") : false;
                    if (!ctx) {

                        return;
                    }

                    ctx.clearRect(0, 0, document.getElementById("graphPeopleStat").width, document.getElementById("graphPeopleStat").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#graphPeopleStat").parent().width();

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
                };
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Новых участников",
                                data: data.subscribedDataSet,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }, {
                                label: "Вышедших участников",
                                data: data.unsubscribedDataSet,
                                fill: false,
                                borderColor: '#b05c91',
                                backgroundColor: '#b05c91'
                            }]
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

                return {
                    showGraph: showGraph
                }
            })();

            var subscribersStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("subscribersStatGraph") ? document.getElementById("subscribersStatGraph").getContext("2d") : false;
                    if (!ctx) {

                        return;
                    }
                    ctx.clearRect(0, 0, document.getElementById("subscribersStatGraph").width, document.getElementById("subscribersStatGraph").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#subscribersStatGraph").parent().width();

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
                };
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Количество участников",
                                data: data.membersCount,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }]
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

                return {
                    showGraph: showGraph
                }
            })();

            var attendanceStatGraph = (function () {
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

                    var config = peopleStatGraphConfig(data);
                    var ctx = document.getElementById("attendanceStatGraph") ? document.getElementById("attendanceStatGraph").getContext("2d") : false;
                    if (!ctx) {

                        return;
                    }
                    ctx.clearRect(0, 0, document.getElementById("attendanceStatGraph").width, document.getElementById("attendanceStatGraph").height);
                    ctx.canvas.height = 300;
                    ctx.canvas.width = $("#attendanceStatGraph").parent().width();

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
                };
                var peopleStatGraphConfig = function (data) {
                    return {
                        type: 'line',
                        data: {
                            labels: data.labels,
                            datasets: [{
                                label: "Просмотров",
                                data: data.viewsData,
                                fill: false,
                                borderColor: '#597da3',
                                backgroundColor: '#597da3',
                                pointBorderWidth: 2,
                                pointHoverRadius: 3
                            }, {
                                label: "Посещений",
                                data: data.visitorsData,
                                fill: false,
                                borderColor: '#b05c91',
                                backgroundColor: '#b05c91'
                            }]
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

                return {
                    showGraph: showGraph
                }
            })();

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
                        if (lastData.graph.graphPeopleStatData)
                            peopleStatGraph.showGraph(lastData.graph.graphPeopleStatData);

                        if (lastData.graph.subscribersStatData)
                            subscribersStatGraph.showGraph(lastData.graph.subscribersStatData);

                        if (lastData.graph.attendanceStatData)
                            attendanceStatGraph.showGraph(lastData.graph.attendanceStatData);

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
                }

                return {
                    from: moment(dateFrom).format("YYYY-MM-DD"),
                    to: moment(dateTo).format("YYYY-MM-DD"),
                    unixFrom: dateFrom / 1000,
                    unixTo: dateTo / 1000
                };
            }

            function getStat(isExample) {
                if (!appState.isActiveUser() && !isExample){
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
                $scope.activeTab = 'dynamic';

                var parseDate = getCheckedDate();
                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);
                var vkGid;
                var groupInfo;

                $scope.stat.groupAddress = $scope.model.groupAddress;
                $scope.stat.periodValue = $('input[name=checkDate]:checked').val();

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
                }).then(function (res) {

                    if (res && res.error && res.error.error_code == 100) {
                        $scope.$apply(function () {
                            $scope.urlError = 'Введеная группа вконтакте не найдена';
                            $scope.isLoading = false;
                            $scope.statIsLoaded = false;
                        });
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
                        $scope.stat.groupImage = res.photo_medium;
                        $scope.stat.description = res.description;
                        $scope.stat.screen_name = res.screen_name;
                        vkGid = res.gid;
                    });
                    groupInfo = res;

                    /*{
                     id: 197133948,
                     first_name: 'Sam',
                     last_name: 'Ty-Takoi',
                     deactivated: 'banned'
                     },*/

                    $.when(
                        getPeopleStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
                        }),
                        getWallStat().always(()=> {
                            $scope.nextProgressStep($scope.percentItem);
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


                        if (res && res.error && res.error.error_code == 7) {
                            //Статистика группы недоступна
                            $scope.statNotAccess = true;
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

                        peopleStatGraph.showGraph(graphPeopleStatData);
                        subscribersStatGraph.showGraph(subscribersStatData);
                        attendanceStatGraph.showGraph(attendanceStatData);

                        deferr.resolve();

                        function getDateFromVk(dateVk) {
                            var normilizedDate = new Date(dateVk);
                            return ('0' + normilizedDate.getDate()).slice(-2) + "." + ('0' + (normilizedDate.getMonth() + 1)).slice(-2);
                        }
                    }).fail(function () {
                        deferr.reject();
                    });
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
                        }
                    };

                    getWall();

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
                                $scope.$apply(function () {
                                    $scope.stat.wall = {
                                        allPosts: wallStat.counters.allWallPostsCount,
                                        postsPeriod: wallStat.counters.wallPostsPeriodCount,
                                        likesPeriod: wallStat.activity.likesPeriodCount,
                                        repostsPeriod: wallStat.activity.repostsPeriodCount,
                                        commentsPeriod: wallStat.activity.commentsPeriodCount
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
                switch (tab) {
                    case 'activity':
                        $scope.activeTab = 'activity';
                        break;
                    case 'dynamic':
                        $scope.activeTab = 'dynamic';
                        break;
                    case 'content':
                        $scope.activeTab = 'content';
                        break;
                }
            }

            function getStatExample(urlOrScreenName){
                if ($scope.isLoading){
                    notify.info("Дождитесь завершения получения статистики");
                    return;
                }
                $scope.model.groupAddress = urlOrScreenName;
                getStat(true);
            }

            init();


        }]);