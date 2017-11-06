import bus from './../../core/busModule.js';
import topics from './../../topics.js';
import events from './../../events.js';

//Получение списка записей на стене по
function getWallStat(data) {
    var group = data.group;
    var authData = data.authData;
    var period = data.period;

    var deferr = $.Deferred();
    var iteration = 0;
    var wallList = [];

    getWall();

    function getWall() {
        if (iteration >= 130) {
            deferr.resolve();
            return;
        }

        bus.request(topics.VK.GET_WALL, authData, {
            groupId: group.gid,
            offset: iteration * 100,
            fields: "views",
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
                res.forEach(function (post) {
                    if (post.date > period.unixFrom && post.date < period.unixTo) {
                        wallList.push(post);
                        flagStop = false;
                    } else if (post.date <= period.unixFrom && !post.is_pinned) {
                        flagStop = true;
                    }
                });
            } else {
                flagStop = true;
            }

            if (!flagStop) {
                iteration++;
                getWall();
            } else {
                deferr.resolve({
                    count: res[0],
                    list: wallList
                });
            }
        }).fail(function () {
            deferr.reject();
        });
    }

    return deferr.promise();
}

export default getWallStat;