<?// подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?
global $USER;
if ($USER->GetID() == $_POST["userId"] && CModule::IncludeModule("iblock")) {
    $el = new CIBlockElement;
    $PROP = array();
    $PROP['SHOP_ID'] = $_POST["currentShopId"];
    $PROP['COST'] = $_POST["cost"];

    $PROP['IMAGES'] = '';
    function resizeImage($fileUrl){
        global $USER;
        $userId = $USER->GetID();
        $destPath = str_replace("/temp/".$userId."/", "/temp/".$userId."/resize/", $_SERVER["DOCUMENT_ROOT"].$fileUrl);
        CFile::ResizeImageFile(
            $sourceFile = $_SERVER["DOCUMENT_ROOT"].$fileUrl,
            $destinationFile =  $destPath,
            $arSize = array('width'=>1024, 'height'=>768),
            $resizeType = BX_RESIZE_IMAGE_PROPORTIONAL,
            $arWaterMark = array(),
            $jpgQuality=false,
            $arFilters =false
        );
        return CFile::MakeFileArray($destPath);
    }

    for ($i=0; $i<count($_POST["images"]); $i++){
        $PROP["IMAGES"][$i] = CFile::SaveFile(resizeImage($_POST["images"][$i]), "shopItemsImages");;

    }

    $arLoadProductArray = Array(
        "MODIFIED_BY" => $USER->GetID(), // элемент изменен текущим пользователем
        "IBLOCK_SECTION_ID" => false,          // элемент лежит в корне раздела
        "IBLOCK_ID" => 17,
        "PROPERTY_VALUES" => $PROP,
        "NAME" => $_POST["name"],
        "ACTIVE" => "Y",            // активен
        "PREVIEW_TEXT" => $_POST["description"],
    );

    $PRODUCT_ID = $el->Add($arLoadProductArray);
    print_r(json_encode(Array('id'=>$PRODUCT_ID)));//'post' => $_POST, 'prop'=>$PROP
} else {
    print_r(json_encode(Array('succes'=>false, 'errorMessage'=>'Добавление товара запрещено!', 'POST'=>$_POST["userId"])));
}


?>
<?//----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/epilog_after.php");?>