import bus from './../../core/busModule.js';
import topics from './../../topics.js';
import events from './../../events.js';

function getVideoStat(data) {
    var group = data.group;
    var authData = data.authData;
    var period = data.period;

    var deferr = $.Deferred();
    var maxIterations = 30,
        iteration = 0,
        list = [],
        flagStop = false;

    getVideo();

    function getVideo() {
        if (iteration >= maxIterations) {
            deferr.resolve({
                count: list && list.length ? list.length : 0,
                list: list
            });
            return;
        }
        bus.request(topics.VK.GET_VIDEO, authData, {
            groupId: group.gid,
            count: 200,
            offset: iteration * 200,
            extended: 1
        }).then(function (res) {
            if (res && res.error && res.error && res.error.error_code == 6) {
                setTimeout(function () {
                    getVideo();
                }, 400);
                return;
            }

            var items = res.items;
            if (items && items.length > 0) {

                items.forEach(function (video) {
                    if (video.date > period.unixFrom && video.date < period.unixTo) {
                        list.push(video);
                    } else if (video.date <= period.unixFrom) {
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
                deferr.resolve({
                    count: res.count,
                    list: list
                });
            }
        }).fail(function () {
            deferr.reject();
        });

    }

    return deferr.promise();
}

export default getVideoStat