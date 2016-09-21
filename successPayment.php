<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/header.php");
$APPLICATION->SetPageProperty("description", "Завершение платежа");
$APPLICATION->SetTitle("Завершение платежа");
?>


<section class="section1">
    <div class="container">
        <div class="general-title text-center">
            <h2>Завершение платежа</h2>

            <p>
                Авторизуйтесь в сервисе заново или обновите страницу, если вкладка с сервисом открыта.
                <br>
                Приятного пользования!
            </p>
            <hr>

            <div class="buttons">
                <a class="dmbutton button" href="/login/">Приступить к работе</a>
            </div>

        </div>

    </div>
    <!-- end container -->
</section>
<!-- end section -->

<section class="section-stat-1">
    <div class="container">
        <div class="general-title text-center">
            <h3>Возможности сервиса</h3>

            <p></p>
            <hr>
        </div>
        <div class="col-lg-4 col-md-4 col-sm-12">
            <div class="servicebox text-center">
                <div class="service-icon">
                    <div class="dm-icon-effect-1" data-effect="slide-bottom">
                        <a class=""> <i class="dm-icon fa fa-bar-chart-o fa-3x"></i> </a>
                    </div>
                    <div class="servicetitle">
                        <h4>Общая статистика</h4>
                        <hr>
                    </div>
                    <p>За выбранный период можно получить различные статистические данные: количество
                        посещений, динамика аудитории, данные по контенту</p>
                </div>
                <!-- service-icon -->
            </div>
            <!-- servicebox -->
        </div>
        <!-- large-3 -->

        <div class="col-lg-4 col-md-4 col-sm-12">
            <div class="servicebox text-center">
                <div class="service-icon">
                    <div class="dm-icon-effect-1" data-effect="slide-bottom">
                        <a class=""> <i class="dm-icon fa fa-star-half-o fa-3x"></i> </a>
                    </div>
                    <div class="servicetitle">
                        <h4>Анализ публикаций</h4>
                        <hr>
                    </div>
                    <p>Анализируйте лучшие публикации в различных группах. Узнайте, какой контент
                        нравится вашим пользователям больше всего.</p>
                </div>
                <!-- service-icon -->
            </div>
            <!-- servicebox -->
        </div>
        <!-- large-3 -->

        <div class="col-lg-4 col-md-4 col-sm-12">
            <div class="servicebox text-center">
                <div class="service-icon">
                    <div class="dm-icon-effect-1" data-effect="slide-bottom">
                        <a class=""> <i class="dm-icon fa fa-pie-chart fa-3x"></i> </a>
                    </div>
                    <div class="servicetitle">
                        <h4>Сравнение аудитории</h4>
                        <hr>
                    </div>
                    <p>Сравнение аудитории двух групп. Позволяет вычислить количество общих пользователей между
                        группами.</p>
                </div>
                <!-- service-icon -->
            </div>
            <!-- servicebox -->
        </div>
        <!-- large-3 -->

    </div>
    <!-- end container -->
</section>


<? require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/footer.php"); ?>
