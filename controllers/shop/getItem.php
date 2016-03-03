<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?

if(CModule::IncludeModule('iblock') && ($arIBlockElement = GetIBlockElement($_GET['id'], 'shop')))
{
    $pagesList = '';
    $pagesList["name"] = $arIBlockElement["NAME"];
    $pagesList["id"] = $arIBlockElement["ID"];
    $pagesList["description"] = $arIBlockElement["PREVIEW_TEXT"];
    $pagesList["cost"] = $arIBlockElement["PROPERTIES"]["COST"]["VALUE"];

    for ($i=0; $i<count($arIBlockElement["PROPERTIES"]["IMAGES"]["VALUE"]); $i++){
        $pagesList["images"][$i] = CFILE::GetPath($arIBlockElement["PROPERTIES"]["IMAGES"]["VALUE"][$i]);
    }

    print_r(json_encode(Array('data'=>$pagesList)));
}


?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>