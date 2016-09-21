import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.favorites')
    .controller('favoritesController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'notify', '$sce',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, notify, $sce) {

            $rootScope.page.sectionTitle = 'Мои отложенные записи';

            $scope.isLoading = false;
            $scope.favoriteListIds = [];
            $scope.favoriteList = [];
            $scope.currentStep = 0;
            $scope.isShowNext = false;

            var maxCountPostsForShow = 40;

            $scope.isShowAnotherPictures = isShowAnotherPictures;
            $scope.isShowGif = isShowGif;
            $scope.showCurrentPicture = showCurrentPicture;
            $scope.getDate = getDate;
            $scope.removeFavorite = removeFavorite;
            $scope.getNext = getNext;
            $scope.showGetNext = showGetNext;
            $scope.getVideoUrl = getVideoUrl;

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            $scope.$watch('isLoading', (newVal)=>{
                $rootScope.globalLoading = newVal;
            });

            $scope.trustSrc = function (src) {
                return $sce.trustAsResourceUrl(src);
            };

            function init() {
                $timeout(()=> {
                    $scope.isLoading = true;
                });
                getFavoritesList();
            }

            function getFavoritesList() {
                return bus.request(topics.FAVORITE.GET_LIST)
                    .then((favoriteListIds)=> {
                        $timeout(()=> {
                            $scope.favoriteListIds = favoriteListIds.data;

                            if (!$scope.favoriteListIds || $scope.favoriteListIds.length == 0) {
                                $timeout(()=> {
                                    notify.info("Любимых записей пока нет.");
                                    $scope.isLoading = false;
                                });
                                return;
                            }

                            $scope.showGetNext();
                        });
                    })
                    .always(()=> {
                        $(".nano").nanoScroller();
                    });
            }

            function isShowAnotherPictures(arr) {
                if (!(arr && arr.length)) {
                    return false;
                }
                var filteredArr = arr.filter((i)=> {
                    return i.type == 'photo';
                });
                return filteredArr.length > 1;
            }

            function isShowGif(arr) {
                if (!(arr && arr.length)) {
                    return false;
                }
                var filteredArr = arr.filter((i)=> {
                    return i.type == 'doc' && i.doc && i.doc.ext == "gif";
                });
                return filteredArr.length > 0;
            }

            function showCurrentPicture(url, index) {
                $(".publishItem" + index + " .image img").attr("src", url);
            }

            function getDate(date) {
                return moment(date * 1000).format("DD.MM.YYYY HH:mm")
            }

            function removeFavorite(post, index) {
                return bus.request(topics.FAVORITE.REMOVE, {
                    id: $scope.favoriteListIds[index].id
                })
                    .then((res)=> {
                        if (res && res.success) {
                            $scope.$apply(()=> {
                                $scope.favoriteList[index].isRemoved = true;
                            });
                            notify.success("Запись удалена");
                        } else {
                            notify.success("Не удалось удалить запись, попробуйте выполнить операцию позже");
                        }
                    })
                    .fail(()=> {
                        notify.success("Не удалось удалить запись, попробуйте выполнить операцию позже");
                    });
            }

            function getNext() {
                var postsString = [];
                for (var i = $scope.currentStep * maxCountPostsForShow; i < ($scope.currentStep + 1) * maxCountPostsForShow; i++) {
                    if (!$scope.favoriteListIds[i]) {
                        i = ($scope.currentStep + 1) * maxCountPostsForShow;
                    } else {
                        if (i != 0)
                            postsString += ",";

                        postsString += $scope.favoriteListIds[i].postId;
                    }
                }
                if ($scope.favoriteListIds && $scope.favoriteListIds.length > ($scope.currentStep + 1) * maxCountPostsForShow) {
                    $scope.isShowNext = true;
                    $scope.currentStep++;
                } else {
                    $scope.isShowNext = false;
                }

                return postsString;
            }

            function showGetNext() {
                var postsString = getNext();
                vkApiFactory.wallGetById(authData, {
                    posts: postsString
                })
                    .then((res)=> {
                        $timeout(()=> {
                            if (res && res.length > 0) {
                                res.forEach((item)=>{
                                    $scope.favoriteList.push(item);
                                    $timeout(()=>{
                                        $(".nano").nanoScroller();
                                    }, 300);
                                });
                            } else
                                $scope.favoriteList = [];
                            $scope.isLoading = false;
                            $(".nano").nanoScroller();
                        });
                    })
                    .always(()=> {
                        $timeout(()=> {
                            $scope.isLoading = false;
                        })
                    });
            }

            function getVideoUrl(video) {
                video = video.video ? video.video : video;
                return vkApiFactory.getVideo(authData, {
                    videos: video.owner_id + "_" + video.vid + "_" + video.access_key
                })
                    .then((result)=> {
                        if (result && result.items && result.items[0]) {
                            $timeout(()=> {
                                video.url = result.items[0].player;
                            });
                        }
                        else {
                            notify.error("Не удалось получить видеозапись.");
                        }
                    });
            }

            init();
        }]);