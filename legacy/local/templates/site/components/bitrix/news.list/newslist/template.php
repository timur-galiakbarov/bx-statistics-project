<? if (!defined("B_PROLOG_INCLUDED") || B_PROLOG_INCLUDED !== true) die();
/** @var array $arParams */
/** @var array $arResult */
/** @global CMain $APPLICATION */
/** @global CUser $USER */
/** @global CDatabase $DB */
/** @var CBitrixComponentTemplate $this */
/** @var string $templateName */
/** @var string $templateFile */
/** @var string $templateFolder */
/** @var string $componentPath */
/** @var CBitrixComponent $component */
$this->setFrameMode(true);
?>
<div class="news-list">
    <? foreach($arResult["ITEMS"] as $arItem):?>
	<?
	$this->AddEditAction($arItem['ID'], $arItem['EDIT_LINK'], CIBlock::GetArrayByID($arItem["IBLOCK_ID"], "ELEMENT_EDIT"));
	$this->AddDeleteAction($arItem['ID'], $arItem['DELETE_LINK'], CIBlock::GetArrayByID($arItem["IBLOCK_ID"], "ELEMENT_DELETE"), array("CONFIRM" => GetMessage('CT_BNL_ELEMENT_DELETE_CONFIRM')));
	?>
	<!-- STANDARD POST -->
	<article class="blog-wrap ">
		<!--<div class="blog-media">
			<div class="he-wrap tpl2">
				<img alt="" src="demos/slides_01.jpg">
			</div>
		</div>-->

		<header class="page-header blog-title">
			<!--<div class="author-wrap">
					<span class="inside">
						<a href="#"><img class="img-responsive" alt="" src="demos/team_03.png"></a>
					</span>
			</div>-->
			<h3 class="general-title"><?echo $arItem["NAME"]?></h3>
			<div class="post-meta">
				<p>
					Опубликовано: <span class="publish-on"><?echo $arItem["ACTIVE_FROM"]?></span>
					<!--<span class="sep">/</span> Category: <a href="#">News</a>
					<span class="sep">/</span> Comments: <a href="#"> 4 Comments</a>-->
				</p>
			</div>
		</header>

		<div class="post-desc">
			<p>
			<?=$arItem["PREVIEW_TEXT"]?>
			</p>
		</div>
	</article>

		<!--<div class=" text-center">
            <ul class="pagination">
                <li><a href="#">«</a></li>
                <li><a href="#">1</a></li>
                <li><a href="#">2</a></li>
                <li><a href="#">3</a></li>
                <li><a href="#">»</a></li>
            </ul>
        </div>-->

<?endforeach; ?>

	<div class="clearfix"></div>


    <? if ($arParams["DISPLAY_BOTTOM_PAGER"]): ?>
		<hr>
        <?= $arResult["NAV_STRING"] ?>
    <? endif; ?>
</div>
