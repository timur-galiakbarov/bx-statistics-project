import topics from './../../../../bl/topics.js';
import events from './../../../../bl/events.js';

(function (module, angular) {

    module.factory('statPopupsFactory', statPopupsFactory);

    statPopupsFactory.$inject = ['$modal', 'bus', 'appState'];

    function statPopupsFactory($modal, bus, appState) {

        var openAddItemPopup = function () {

            $modal.open({
                animation: true,
                templateUrl: './templates/js/ui/stat/services/statPopupsFactory/views/addItemPopup.html',
                controller: function ($scope, $modalInstance, FileUploader) {
                    var uploader = $scope.uploader = new FileUploader({
                        url: '/controllers/shop/uploadImages.php'
                    });

                    // FILTERS

                    uploader.filters.push({
                        name: 'imageFilter',
                        fn: function (item /*{File|FileLikeObject}*/, options) {
                            var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
                            return '|jpg|png|jpeg|'.indexOf(type) !== -1;
                        }
                    });

                    // CALLBACKS

                    uploader.onWhenAddingFileFailed = function (item /*{File|FileLikeObject}*/, filter, options) {
                        //console.info('onWhenAddingFileFailed', item, filter, options);
                    };
                    uploader.onBeforeUploadItem = function (item) {
                        //console.info('onBeforeUploadItem', item);
                    };
                    uploader.onProgressItem = function (fileItem, progress) {
                        //console.info('onProgressItem', fileItem, progress);
                    };
                    uploader.onProgressAll = function (progress) {
                        //console.info('onProgressAll', progress);
                    };
                    uploader.onSuccessItem = function (fileItem, response, status, headers) {
                        //console.info('onSuccessItem', fileItem, response, status, headers);
                    };
                    uploader.onErrorItem = function (fileItem, response, status, headers) {
                        //console.info('onErrorItem', fileItem, response, status, headers);
                    };
                    uploader.onCancelItem = function (fileItem, response, status, headers) {
                        console.info('onCancelItem', fileItem, response, status, headers);
                    };
                    uploader.onCompleteItem = function (fileItem, response, status, headers) {
                        //console.info('onCompleteItem', fileItem, response, status, headers);
                    };
                    //console.info('uploader', uploader);

                    var path = '/upload/temp/' + appState.getUserId() + '/';
                    var imagesArr = [];
                    uploader.onAfterAddingFile = function (fileItem) {

                    };
                    uploader.onAfterAddingAll = function (addedFileItems) {

                    };
                    uploader.onCompleteAll = function () {
                        sendData();
                    };

                    $scope.item = {
                        name: '',
                        cost: '',
                        description: '',
                        images: '',
                        userId: appState.getUserId(),
                        currentShopId: appState.getCurrentShopId()
                    };
                    $scope.isLoadImages = false;

                    $scope.add = function () {
                        if (!$scope.api.form.validate()) {
                            return;
                        }
                        if (uploader.queue.length > 0) {
                            for (var i = 0; i < uploader.queue.length; i++) {
                                imagesArr.push(path + uploader.queue[i]._file.name);
                            }
                            $scope.item.images = imagesArr;
                            $scope.isLoadImages = true;
                            uploader.uploadAll();
                        } else {
                            sendData();
                        }
                    };

                    var sendData = function () {
                        bus.request(topics.SHOP.ADD_ITEM, $scope.item).then((res)=> {
                            bus.publish(events.SHOP.ITEM_CREATED, res);
                            $modalInstance.close();
                        })
                    };
                    $scope.close = function () {
                        $modalInstance.close();
                    };
                },
            });
        };

        var openEditItemPopup = function (id) {
            bus.request(topics.SHOP.GET_ITEM, {id: id}).then((res)=> {
                console.log(res);
            });
        };

        var openItemPopup = function (id) {
            $modal.open({
                animation: true,
                templateUrl: './templates/js/ui/stat/services/statPopupsFactory/views/openItemPopup.html',
                controller: function ($scope, $modalInstance) {
                    $scope.isLoading = true;

                    bus.request(topics.SHOP.GET_ITEM, {id: id}).then((res)=> {
                        res = res.data;
                        console.log(res);
                        $scope.$apply(function(){
                            $scope.model = {
                                name: res.name,
                                images: res.images,
                                cost: res.cost,
                            };
                            $scope.isLoading = false;
                        });
                    });

                    $scope.$on('onFinishRenderImages', function (event, data) {
                        $(document).ready(function(){
                            var owl = $("#carousel" + data);
                            owl.owlCarousel({
                                autoPlay: false,

                                items : 3,
                                itemsDesktop : [1199,3],
                                itemsDesktopSmall : [979,3],
                                itemsTablet: [768, 3],
                                itemsMobile: [479, 2],
                                pagination: false,
                                navigation: false
                            });

                            $(".nano").nanoScroller();
                        });
                    });

                    $scope.close = function () {
                        $modalInstance.close();
                    };
                }
            });
        };

        var openRemoveItemPopup = function (options) {
            $modal.open({
                animation: true,
                templateUrl: './templates/js/ui/stat/services/statPopupsFactory/views/removeItemPopup.html',
                controller: function ($scope, $modalInstance) {
                    $scope.item = {
                        name: options.name,
                        userId: appState.getUserId(),
                        currentShopId: appState.getCurrentShopId(),
                        id: options.id
                    };

                    $scope.remove = function () {
                        if ($scope.item.id) {
                            bus.request(topics.SHOP.REMOVE_ITEM, $scope.item).then((res)=> {
                                bus.publish(events.SHOP.ITEM_REMOVED, res);
                                //console.log(res);
                            });
                        }
                        //Закрываем попап
                        $modalInstance.close();
                    };
                    $scope.close = function () {
                        $modalInstance.close();
                    };
                },
            });
        };


        return {
            openAddItemPopup: openAddItemPopup,
            openRemoveItemPopup: openRemoveItemPopup,
            openEditItemPopup: openEditItemPopup,
            openItemPopup: openItemPopup
        }

    }

})(angular.module("rad.stat"), angular);