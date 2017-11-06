angular
    .module('rad.stat')
    .directive('postDefault', postDefault);

postDefault.$inject = ['$state', '$rootScope', 'notify', 'appState'];

function postDefault($state, $rootScope, notify, appState) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/analytics/directives/postDefault/postDefault.html',
        controller: ['$scope', '$state', function ($scope, $state) {

        }],
        scope: {
            data: "=",
            groupInfo: "=",
            view: "=?"
        },
        link: function ($scope) {

            $scope.getDate = getDate;
            $scope.getVideoPreview = getVideoPreview;

            $scope.wallPost = _.cloneDeep($scope.data);

            init();

            function getDate(date) {
                return moment(date * 1000).format("DD.MM.YYYY HH:mm")
            }

            function init() {
                var firstImage = "";
                var firstVideo = "";
                var firstDoc = "";
                if ($scope.wallPost.attachments && $scope.wallPost.attachments.length) {
                    firstImage = $scope.wallPost.attachments.filter((a)=> {
                        return a.type == "photo";
                    })[0];

                    firstVideo = $scope.wallPost.attachments.filter((a)=> {
                        return a.type == "video";
                    })[0];

                    firstDoc = $scope.wallPost.attachments.filter((a)=> {
                        return a.type == "doc" && a.doc && a.doc.ext == "gif";
                    })[0];
                }

                angular.extend($scope.wallPost, {
                    firstImage: firstImage,
                    firstVideo: firstVideo,
                    firstDoc: firstDoc
                });
            }

            function getVideoPreview(){
                if ($scope.wallPost && $scope.wallPost.firstVideo && $scope.wallPost.firstVideo.video){
                    return $scope.wallPost.firstVideo.video.photo_640 || $scope.wallPost.firstVideo.video.photo_800
                    || $scope.wallPost.firstVideo.video.photo_320;
                }

                return "";
            }

        }
    };
}