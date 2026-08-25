<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?php
require_once './PHPExcel/PHPExcel.php'; // Подключаем библиотеку PHPExcel
$phpexcel = new PHPExcel(); // Создаём объект PHPExcel

$dataPost = $_POST;

if ($dataPost["offset"] < $dataPost["count"]) {
    $_SESSION["reportBanned"][$dataPost["iteration"]] = $dataPost["list"];
    print_r(json_encode(Array("success" => true, "executedCount" => $dataPost["offset"], "iteration" => $dataPost["iteration"])));
    return;
} else {
    $_SESSION["reportBanned"][$dataPost["iteration"]] = $dataPost["list"];
}

/* Каждый раз делаем активной 1-ю страницу и получаем её, потом записываем в неё данные */
$page = $phpexcel->setActiveSheetIndex(0); // Делаем активной первую страницу и получаем её

$i = 1;
foreach ($_SESSION["reportBanned"] as $arr) {
    $list = json_decode($arr);

    foreach ($list as $value) {
        $page->setCellValue("A" . $i, $i);
        $page->setCellValue("B" . $i, strval($value->uid . ""));
        $page->setCellValue("C" . $i, strval($value->first_name . " " . $value->last_name));
        $page->setCellValue("D" . $i, strval($value->deactivated));

        $i++;
    }
}
$page->getColumnDimension('B')->setWidth(20);
$page->getColumnDimension('C')->setWidth(25);
$page->setTitle("Список забаненных"); // Ставим заголовок на странице

/* Начинаем готовиться к записи информации в xlsx-файл */
$objWriter = PHPExcel_IOFactory::createWriter($phpexcel, 'Excel2007');

/* Записываем в файл */
global $USER;
$objWriter->save("reports/" . "socstat_ban_" . $USER->GetID() . "_" . $dataPost["dateCreate"] . ".xlsx");

print_r(json_encode(Array("success" => true, "reportUrl" => "/controllers/common/reports/" . "socstat_ban_" . $USER->GetID() . "_" . $dataPost["dateCreate"] . ".xlsx")));
$_SESSION["reportBanned"] = null;
?>
<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>
