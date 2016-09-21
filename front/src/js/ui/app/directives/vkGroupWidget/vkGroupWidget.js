import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('vkGroupWidget', vkGroupWidget);

function vkGroupWidget() {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/app/directives/vkGroupWidget/vkGroupWidget.html',
        controller: ['$scope', '$timeout', function ($scope, $timeout) {

        }],
        link: link
    };
}

function link($scope) {
    function initVk() {
        $("#vk_groups").html("");
        setTimeout(()=> {
            $("#vk_groups").html(" ");
            VK.Widgets.Group("vk_groups", {
                mode: 4,
                width: $("#vk_groups").parent().css("width"),
                height: "400",
                color1: 'FFFFFF',
                color2: '000000',
                color3: '5E81A8'
            }, 125792332);
        });
    }

    jQuery(window).resize(_.debounce(function () {
        $("#vk_groups").html("");
        initVk();
    }, 1000));

    initVk();
}