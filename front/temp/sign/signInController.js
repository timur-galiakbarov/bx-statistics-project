import topics from './../../bl/topics.js';

angular
    .module('app')
    .controller('signInController', ['$rootScope', '$scope', '$state', 'bus',
        function($rootScope, $scope, $state, bus) {
            $scope.auth = {
                login: '',
                password: ''
            };

            $scope.auth = function(){
                bus.request(topics.ACCOUNT.LOGIN, {
                    data: {
                        login: $scope.auth.login,
                        password: $scope.auth.password,
                    }
                }).then((res)=>{
                    console.log(res);
                })

            };
            //$rootScope.page.sectionTitle = 'Настройки';
        }]);