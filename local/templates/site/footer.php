<? if ($APPLICATION->GetCurPage() != "/") { ?>
</div>
        <!-- end content -->


        <!-- BEGIN SIDEBAR -->
        <div id="sidebar" class="col-lg-4 col-md-4 col-sm-4 col-xs-12">

            <div class="widget">
                <h4 class="title">
                    <span>Разделы</span>
                </h4>

                <?$APPLICATION->IncludeComponent(
	"bitrix:menu",
	"leftMenu",
	Array(
		"ALLOW_MULTI_SELECT" => "N",
		"CHILD_MENU_TYPE" => "left",
		"DELAY" => "N",
		"MAX_LEVEL" => "1",
		"MENU_CACHE_GET_VARS" => array(""),
		"MENU_CACHE_TIME" => "3600",
		"MENU_CACHE_TYPE" => "N",
		"MENU_CACHE_USE_GROUPS" => "Y",
		"ROOT_MENU_TYPE" => "left",
		"USE_EXT" => "N"
	)
);?>
            </div>

            <div class="widget">
                <h4 class="title">
                    <span>Наша группа</span>
                </h4>
                <!-- VK Widget -->
                <div id="vk_groups"></div>
            </div>


        </div>
        <!-- end sidebar -->
    </div>
    <!-- end container -->
</section><!-- end section -->
<?} ?>
<footer class="footer">
    <? /*<div class="container">
        <div class="widget col-lg-3 col-md-3 col-sm-12">
            <h4 class="title">About us</h4>

            <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the
                industry"s standard dummy text ever since the 1500s..</p>
            <a class="button small" href="#">read more</a>
        </div>
        <!-- end widget -->
        <div class="widget col-lg-3 col-md-3 col-sm-12">
            <h4 class="title">Recent Posts</h4>
            <ul class="recent_posts">
                <li>
                    <a href="home1.html#">
                        <img src="<?= SITE_TEMPLATE_PATH ?>/demos/recent_post_01.png" alt=""/>Our New Dashboard Is Here
                    </a>
                    <a class="readmore" href="#">read more</a>
                </li>
                <li>
                    <a href="home1.html#">
                        <img src="<?= SITE_TEMPLATE_PATH ?>/demos/recent_post_02.png" alt=""/>Design Is In The Air
                    </a>
                    <a class="readmore" href="#">read more</a>
                </li>
            </ul>
            <!-- recent posts -->
        </div>
        <!-- end widget -->
        <div class="widget col-lg-3 col-md-3 col-sm-12">
            <h4 class="title">Get In Touch</h4>
            <ul class="contact_details">
                <li><i class="fa fa-envelope-o"></i> info@yoursite.com</li>
                <li><i class="fa fa-phone-square"></i> +34 5565 6555</li>
                <li><i class="fa fa-home"></i> Some Fine Address, 887, Madrid, Spain.</li>
                <li><a href="#"><i class="fa fa-map-marker"></i> View large map</a></li>
            </ul>
            <!-- contact_details -->
        </div>
        <!-- end widget -->
        <div class="widget col-lg-3 col-md-3 col-sm-12">
            <h4 class="title">Flickr Stream</h4>
            <ul class="flickr">
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_01.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_02.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_03.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_04.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_05.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_06.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_07.jpg"></a></li>
                <li><a href="#"><img alt="" src="<?= SITE_TEMPLATE_PATH ?>/demos/flickr_08.jpg"></a></li>
            </ul>
        </div>
        <!-- end widget -->
    </div>*/ ?>
    <!-- end container -->

    <div class="copyrights">
        <div class="container">
            <div class="col-lg-6 col-md-6 col-sm-12 columns">
                <p>socstat.ru 2016 - Анализ и статистика групп вконтакте</p>
            </div>
            <!-- end widget -->
            <div class="col-lg-6 col-md-6 col-sm-12 columns text-right">
                <div class="footer-menu right">

                </div>
            </div>
            <!-- end large-6 -->
        </div>
        <!-- end container -->
    </div>
    <!-- end copyrights -->
</footer>
<!-- end footer -->
<div class="dmtop">Scroll to Top</div>

<!-- Main Scripts-->
<script src="<?= SITE_TEMPLATE_PATH ?>/assets/js/jquery.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/assets/js/bootstrap.min.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/assets/js/jquery.unveilEffects.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/retina-1.1.0.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/jquery.hoverdir.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/owl.carousel.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/jetmenu.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/jquery.hoverex.min.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/jquery.prettyPhoto.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/jquery.isotope.min.js"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/js/custom.js"></script>

<!-- LayerSlider script files -->
<script src="<?= SITE_TEMPLATE_PATH ?>/layerslider/js/greensock.js" type="text/javascript"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/layerslider/js/layerslider.transitions.js" type="text/javascript"></script>
<script src="<?= SITE_TEMPLATE_PATH ?>/layerslider/js/layerslider.kreaturamedia.jquery.js"
        type="text/javascript"></script>
<!-- Initializing the slider -->
<script>
    jQuery("#layerslider").layerSlider({
        pauseOnHover: false,
        autoPlayVideos: false,
        responsive: false,
        responsiveUnder: 1280,
        layersContainer: 1280,
        skin: 'v5',
        skinsPath: 'layerslider/skins/'
    });
</script>

<script>
    // Portfolio
    (function ($) {
        "use strict";
        var $container = $('.portfolio'),
            $items = $container.find('.portfolio-item'),
            portfolioLayout = 'fitRows';

        if ($container.hasClass('portfolio-centered')) {
            portfolioLayout = 'masonry';
        }

        $container.isotope({
            filter: '*',
            animationEngine: 'best-available',
            layoutMode: portfolioLayout,
            animationOptions: {
                duration: 750,
                easing: 'linear',
                queue: false
            },
            masonry: {}
        }, refreshWaypoints());

        function refreshWaypoints() {
            setTimeout(function () {
            }, 1000);
        }

        $('nav.portfolio-filter ul a').on('click', function () {
            var selector = $(this).attr('data-filter');
            $container.isotope({filter: selector}, refreshWaypoints());
            $('nav.portfolio-filter ul a').removeClass('active');
            $(this).addClass('active');
            return false;
        });

        function getColumnNumber() {
            var winWidth = $(window).width(),
                columnNumber = 1;

            if (winWidth > 1200) {
                columnNumber = 5;
            } else if (winWidth > 950) {
                columnNumber = 4;
            } else if (winWidth > 600) {
                columnNumber = 3;
            } else if (winWidth > 400) {
                columnNumber = 2;
            } else if (winWidth > 250) {
                columnNumber = 1;
            }
            return columnNumber;
        }

        function setColumns() {
            var winWidth = $(window).width(),
                columnNumber = getColumnNumber(),
                itemWidth = Math.floor(winWidth / columnNumber);

            $container.find('.portfolio-item').each(function () {
                $(this).css({
                    width: itemWidth + 'px'
                });
            });
        }

        function setPortfolio() {
            setColumns();
            $container.isotope('reLayout');
        }

        $container.imagesLoaded(function () {
            setPortfolio();
        });

        $(window).on('resize', function () {
            setPortfolio();
        });
    })(jQuery);
</script>

<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function (d, w, c) {
        (w[c] = w[c] || []).push(function () {
            try {
                w.yaCounter38791285 = new Ya.Metrika({
                    id: 38791285,
                    clickmap: true,
                    trackLinks: true,
                    accurateTrackBounce: true,
                    webvisor: true,
                    trackHash: true
                });
            } catch (e) {
            }
        });

        var n = d.getElementsByTagName("script")[0],
            s = d.createElement("script"),
            f = function () {
                n.parentNode.insertBefore(s, n);
            };
        s.type = "text/javascript";
        s.async = true;
        s.src = "https://mc.yandex.ru/metrika/watch.js";

        if (w.opera == "[object Opera]") {
            d.addEventListener("DOMContentLoaded", f, false);
        } else {
            f();
        }
    })(document, window, "yandex_metrika_callbacks");
</script>
<noscript>
    <div><img src="https://mc.yandex.ru/watch/38791285" style="position:absolute; left:-9999px;" alt=""/></div>
</noscript>
<!-- /Yandex.Metrika counter -->