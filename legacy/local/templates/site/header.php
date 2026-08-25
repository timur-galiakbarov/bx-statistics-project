<!DOCTYPE html>
<html>
<head>

    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="yandex-verification" content="7b8f5f86e582c7ce"/>
    <meta name="interkassa-verification" content="bb08cdb6549851afbc632bd568c19b9e"/>
    <?= $APPLICATION->ShowHead() ?>
    <title><?= $APPLICATION->ShowTitle() ?></title>
    <!-- Google Fonts -->
    <link href='http://fonts.googleapis.com/css?family=Ruda:400,900,700' rel='stylesheet' type='text/css'>

    <!-- Font Awesome -->
    <link rel="stylesheet" href="<?= SITE_TEMPLATE_PATH ?>/css/font-awesome.css">
    <!-- Bootstrap -->
    <link href="<?= SITE_TEMPLATE_PATH ?>/assets/css/bootstrap.css" rel="stylesheet">
    <!-- Template Styles -->
    <link rel="stylesheet" href="<?= SITE_TEMPLATE_PATH ?>/css/style.css">
    <link rel="stylesheet" href="<?= SITE_TEMPLATE_PATH ?>/css/colors/blue.css">
    <!-- Layer Slider -->
    <link rel="stylesheet" href="<?= SITE_TEMPLATE_PATH ?>/layerslider/css/layerslider.css" type="text/css">


    <!-- Support for HTML5 -->
    <!--[if lt IE 9]>
    <script src="http://html5shim.googlecode.com/svn/trunk/html5.js"></script>
    <![endif]-->

    <!-- Enable media queries on older browsers -->
    <!--[if lt IE 9]>
    <script src="<?=SITE_TEMPLATE_PATH?>/assets/js/respond.min.js"></script>
    <![endif]-->

    <script src="<?= SITE_TEMPLATE_PATH ?>/js/modernizr.js"></script>
    <script type="text/javascript" src="//vk.com/js/api/openapi.js?125"></script>
</head>
<body class="texture">
<?= $APPLICATION->ShowPanel() ?>

<div class="topbar clearfix">
    <div class="container">
        <div class="col-lg-12 text-right">

        </div>
    </div>
    <!-- end container -->
</div>
<!-- end topbar -->

<header class="header">
    <div class="container">
        <div class="site-header clearfix">
            <div class="col-lg-3 col-md-3 col-sm-12 title-area">
                <div class="site-title" id="title">
                    <a href="/" title="">
                        <h4>SOC<span>STAT.RU</span></h4>
                    </a>
                </div>
            </div>
            <!-- title area -->
            <div class="col-lg-9 col-md-12 col-sm-12">
                <? $APPLICATION->IncludeComponent("bitrix:menu", "mainMenu", Array(
                    "ROOT_MENU_TYPE" => "top",    // Тип меню для первого уровня
                    "MENU_CACHE_TYPE" => "N",    // Тип кеширования
                    "MENU_CACHE_TIME" => "3600",    // Время кеширования (сек.)
                    "MENU_CACHE_USE_GROUPS" => "Y",    // Учитывать права доступа
                    "MENU_CACHE_GET_VARS" => "",    // Значимые переменные запроса
                    "MAX_LEVEL" => "1",    // Уровень вложенности меню
                    "USE_EXT" => "N",    // Подключать файлы с именами вида .тип_меню.menu_ext.php
                    "DELAY" => "N",    // Откладывать выполнение шаблона меню
                    "ALLOW_MULTI_SELECT" => "N",    // Разрешить несколько активных пунктов одновременно
                    "COMPONENT_TEMPLATE" => ".default",
                    "CHILD_MENU_TYPE" => "left",    // Тип меню для остальных уровней
                ),
                    false
                ); ?>

            </div>
            <!-- title area -->
        </div>
        <!-- site header -->
    </div>
    <!-- end container -->
</header>
<!-- end header -->

<? if ($APPLICATION->GetCurPage() != "/") { ?>
<section class="post-wrapper-top">
    <div class="container">
        <div class="col-lg-6 col-md-6 col-sm-6 col-xs-12">
            <? $APPLICATION->IncludeComponent("bitrix:breadcrumb", "breadcrumb", Array(),
                false
            ); ?>
            <h2><? $APPLICATION->showTitle() ?></h2>
        </div>
        <div class="col-lg-6 col-md-6 col-sm-6 col-xs-12">
            <!-- search -->
            <!--<div class="search-bar">
                <form action="" method="get">
                    <fieldset>
                        <input type="image" src="images/pixel.gif" class="searchsubmit" alt=""/>
                        <input type="text" class="search_text showtextback" name="s" id="s" value="Search..."/>
                    </fieldset>
                </form>
            </div>-->
            <!-- / end div .search-bar -->
        </div>
    </div>
</section>
<!-- end post-wrapper-top -->

<section class="section1">
    <div class="container clearfix">
        <div class="content pull-right col-lg-8 col-md-8 col-sm-8 col-xs-12 clearfix">

            <? } ?>
