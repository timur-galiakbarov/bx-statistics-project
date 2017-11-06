import bus from './../../core/busModule.js';
import topics from './../../topics.js';
import events from './../../events.js';

function getPhotoCommentsStat(data) {
    var group = data.group;
    var authData = data.authData;
    var period = data.period;

    var deferr = $.Deferred();
    var maxIterations = 50,
        iteration = 0,
        flagStop = false,
        list = [],
        count = 0;

    getPhotosComments();

    function getPhotosComments() {
        if (iteration >= maxIterations) {
            deferr.resolve({
                allCount: 0,
                list: []
            });
            return;
        }
        bus.request(topics.VK.GET_PHOTO_COMMENTS, authData, {
            groupId: group.gid,
            count: 100,
            offset: iteration * 100
        }).then(function (res) {
            if (res && res.error && res.error && res.error.error_code == 6) {
                setTimeout(function () {
                    getPhotosComments();
                }, 600);
                return;
            }

            var items = res.items;
            if (items && items.length > 0) {
                items.forEach(function (comment) {
                    if (comment.date > period.unixFrom && comment.date < period.unixTo) {
                        //list.push(comment);
                        count++;
                    } else if (comment.date <= period.unixFrom) {
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
                deferr.resolve({
                    allCount: res.count,
                    list: list,
                    periodCount: count
                });
            }
        }).fail(function () {
            deferr.reject();
        });

    }

    return deferr.promise();
}

export default getPhotoCommentsStat;