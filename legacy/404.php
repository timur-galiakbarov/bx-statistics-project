<?
include_once($_SERVER['DOCUMENT_ROOT'].'/bitrix/modules/main/include/urlrewrite.php');

CHTTP::SetStatus("404 Not Found");
@define("ERROR_404","Y");

require($_SERVER["DOCUMENT_ROOT"]."/bitrix/header.php");

$APPLICATION->SetTitle("404 - страница не найдена");
?>

	<section class="section1">
		<div class="container clearfix">
			<div class="content col-lg-12 col-md-12 col-sm-12 clearfix">
				<div class="notfound">
					<h1 class="big-title">К сожалению, страница не найдена</h1>
					<h4 class="small-title">Возможно, вы просто ошиблись</h4>
					<a class="button" href="/">Перейти на главную</a>
				</div><!-- end message -->
			</div><!-- end content -->
		</div><!-- end container -->
	</section><!-- end section -->
<?

require($_SERVER["DOCUMENT_ROOT"]."/bitrix/footer.php");?>